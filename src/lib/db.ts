import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Client, InArgs, Transaction } from "@libsql/client";
import { BANK_VERSION, seed } from "./seed";

/*
 * Storage is libSQL (SQLite-compatible):
 * - Hosted (Netlify etc.): set TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN.
 * - Local development: falls back to a SQLite file at data/eptprep.db.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id            INTEGER PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  gender        TEXT NOT NULL DEFAULT '',
  course        TEXT NOT NULL DEFAULT '',
  department    TEXT NOT NULL DEFAULT '',
  birthdate     TEXT NOT NULL DEFAULT '',
  access        TEXT NOT NULL DEFAULT 'both' CHECK (access IN ('both','official','practice')),
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- official: timed, one attempt, admin-set limits. practice: unlimited, candidate picks limits.
CREATE TABLE IF NOT EXISTS tests (
  id             INTEGER PRIMARY KEY,
  title          TEXT NOT NULL UNIQUE,
  category       TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  kind           TEXT NOT NULL CHECK (kind IN ('official','practice')),
  time_limit     INTEGER NOT NULL DEFAULT 0,
  question_limit INTEGER NOT NULL DEFAULT 0,
  shuffle        INTEGER NOT NULL DEFAULT 1,
  position       INTEGER NOT NULL DEFAULT 0,
  builtin        INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- **text** in prompt/choices marks words that are underlined in the printed paper.
CREATE TABLE IF NOT EXISTS questions (
  id          INTEGER PRIMARY KEY,
  test_id     INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  topic       TEXT NOT NULL DEFAULT '',
  instruction TEXT NOT NULL DEFAULT '',
  passage     TEXT NOT NULL DEFAULT '',
  prompt      TEXT NOT NULL DEFAULT '',
  choice_a    TEXT NOT NULL,
  choice_b    TEXT NOT NULL,
  choice_c    TEXT NOT NULL,
  choice_d    TEXT NOT NULL,
  answer      TEXT NOT NULL CHECK (answer IN ('A','B','C','D')),
  explanation TEXT NOT NULL DEFAULT '',
  tip         TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS questions_test ON questions(test_id, position);

-- One row per sitting. Times are epoch milliseconds.
CREATE TABLE IF NOT EXISTS attempts (
  id           INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  test_id      INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_ids TEXT NOT NULL,
  started_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  submitted_at INTEGER,
  score        INTEGER,
  total        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_candidate ON attempts(candidate_id, test_id);

CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id  INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  choice      TEXT NOT NULL CHECK (choice IN ('A','B','C','D')),
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id           INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  message      TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export type Row = Record<string, unknown>;
/** Anything that can run a statement: the client itself or an open transaction. */
export type Executor = Pick<Client | Transaction, "execute">;

async function createDbClient(): Promise<Client> {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    // Pure-JS HTTP client: no native binary to bundle into serverless functions.
    const { createClient } = await import("@libsql/client/web");
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  if (process.env.NETLIFY || process.env.VERCEL) {
    throw new Error("TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN) to the site's environment variables.");
  }
  const file = process.env.EPT_DB_PATH ?? path.join(process.cwd(), "data", "eptprep.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const { createClient } = await import("@libsql/client");
  return createClient({ url: `file:${file}` });
}

/** Columns added after the first release; older databases get them on startup. */
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  ["tests", "builtin", "INTEGER NOT NULL DEFAULT 0"],
  ["questions", "explanation", "TEXT NOT NULL DEFAULT ''"],
  ["questions", "tip", "TEXT NOT NULL DEFAULT ''"],
  ["questions", "source", "TEXT NOT NULL DEFAULT ''"],
  ["candidates", "course", "TEXT NOT NULL DEFAULT ''"],
  ["candidates", "department", "TEXT NOT NULL DEFAULT ''"],
];

async function migrate(client: Client) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const cols = await client.execute(`PRAGMA table_info(${table})`);
    if (cols.rows.some((r) => r.name === column)) continue;
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    // Every test that existed before this column was added came from the first built-in seed.
    if (table === "tests" && column === "builtin") await client.execute("UPDATE tests SET builtin = 1");
  }
}

async function open() {
  const client = await createDbClient();
  await client.executeMultiple(SCHEMA);
  await migrate(client);
  await seed(client);
  return client;
}

// One client per server instance, created on first use and reused across hot reloads in development.
// The key changes when the built-in questions or the added columns change, so a running server picks them up.
const contentKey = `${BANK_VERSION}:${ADDED_COLUMNS.length}`;
const globalForDb = globalThis as unknown as { eptDb?: Promise<Client>; eptBankVersion?: string };

export function getDb() {
  let pending: Promise<Client> | undefined;
  if (!globalForDb.eptDb) {
    pending = open();
  } else if (globalForDb.eptBankVersion !== contentKey) {
    // The client survives hot reloads in development; when new built-in content arrives,
    // re-run the schema and seed so it is installed without restarting the server.
    pending = globalForDb.eptDb.then(async (client) => {
      await client.executeMultiple(SCHEMA);
      await migrate(client);
      await seed(client);
      return client;
    });
  }
  if (pending) {
    globalForDb.eptBankVersion = contentKey;
    globalForDb.eptDb = pending.catch((error) => {
      globalForDb.eptDb = undefined; // retry on the next request
      throw error;
    });
  }
  return globalForDb.eptDb!;
}

export async function all(sql: string, args: InArgs = [], ex?: Executor): Promise<Row[]> {
  const rs = await (ex ?? (await getDb())).execute({ sql, args });
  return rs.rows as unknown as Row[];
}

export async function get(sql: string, args: InArgs = [], ex?: Executor): Promise<Row | undefined> {
  return (await all(sql, args, ex))[0];
}

export async function run(sql: string, args: InArgs = [], ex?: Executor) {
  const rs = await (ex ?? (await getDb())).execute({ sql, args });
  return { lastInsertRowid: Number(rs.lastInsertRowid ?? 0), rowsAffected: rs.rowsAffected };
}

export async function transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await (await getDb()).transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
