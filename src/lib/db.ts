import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seed } from "./seed";

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

-- English skill areas: Grammar, Vocabulary, Reading Comprehension, ...
CREATE TABLE IF NOT EXISTS sections (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS candidates (
  id            INTEGER PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  gender        TEXT NOT NULL DEFAULT '',
  birthdate     TEXT NOT NULL DEFAULT '',
  level         TEXT NOT NULL DEFAULT 'B1',
  access        TEXT NOT NULL DEFAULT 'both' CHECK (access IN ('both','official','practice')),
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- official: timed, one attempt, admin-set limits. practice: unlimited, candidate picks limits.
CREATE TABLE IF NOT EXISTS tests (
  id             INTEGER PRIMARY KEY,
  section_id     INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title          TEXT NOT NULL UNIQUE,
  description    TEXT NOT NULL DEFAULT '',
  level          TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('official','practice')),
  time_limit     INTEGER NOT NULL DEFAULT 0,
  question_limit INTEGER NOT NULL DEFAULT 0,
  passage        TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id       INTEGER PRIMARY KEY,
  test_id  INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  prompt   TEXT NOT NULL,
  choice_a TEXT NOT NULL,
  choice_b TEXT NOT NULL,
  choice_c TEXT NOT NULL,
  choice_d TEXT NOT NULL,
  answer   TEXT NOT NULL CHECK (answer IN ('A','B','C','D')),
  UNIQUE (test_id, prompt)
);

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

function open() {
  const file = process.env.EPT_DB_PATH ?? path.join(process.cwd(), "data", "eptprep.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM sections").get() as { n: number };
  if (n === 0) seed(db);
  return db;
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { eptDb?: DatabaseSync };
export const db = globalForDb.eptDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.eptDb = db;

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
