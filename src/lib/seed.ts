import type { Database, Executor } from "./db";
import { hashPassword } from "./password";
import bank from "./seed-data/bank.json";

/**
 * Built-in content: the question bank and the mock papers, generated into seed-data/bank.json
 * by scripts/build-bank.mjs from the files in content/. Each build has a version; when it changes,
 * built-in tests and questions are updated in place, so candidates' attempts and results are kept.
 * Tests created in the admin panel are never touched.
 */
type BankQuestion = {
  ref: string;
  topic: string;
  instruction: string;
  passage: string;
  prompt: string;
  choices: [string, string, string, string];
  answer: "A" | "B" | "C" | "D";
  explanation: string;
  tip: string;
  source: string;
};

type BankFile = {
  version: string;
  bank: { title: string; description: string };
  questions: BankQuestion[];
  mocks: { title: string; description: string; minutes: number; refs: string[] }[];
};

const data = bank as unknown as BankFile;
export const BANK_VERSION = data.version;

/** Rows per statement: 15 values each, well under Postgres's parameter limit. */
const CHUNK = 100;
/** Any fixed number; serialises seeding when several server instances start at once. */
const SEED_LOCK = 7_310_001;

const FIELDS = ["topic", "instruction", "passage", "prompt", "choice_a", "choice_b", "choice_c", "choice_d", "answer", "explanation", "tip", "source"];
const fieldValues = (q: BankQuestion) => [q.topic, q.instruction, q.passage, q.prompt, ...q.choices, q.answer, q.explanation, q.tip, q.source];

/** "($1, $2, ...), ($n+1, ...)" for `rows` rows of `width` parameters. */
const placeholders = (rows: number, width: number) =>
  Array.from({ length: rows }, (_, r) => `(${Array.from({ length: width }, (_, c) => `$${r * width + c + 1}`).join(", ")})`).join(",\n");

type Placed = { position: number; q: BankQuestion };

async function insertQuestions(tx: Executor, testId: number, items: Placed[]) {
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    await tx.query(
      `INSERT INTO questions (test_id, position, ref, ${FIELDS.join(", ")}) VALUES ${placeholders(slice.length, 15)}`,
      slice.flatMap(({ position, q }) => [testId, position, q.ref, ...fieldValues(q)]),
    );
  }
}

async function updateQuestions(tx: Executor, items: (Placed & { id: number })[]) {
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    await tx.query(
      `UPDATE questions AS q
       SET position = v.position::int, ref = v.ref, ${FIELDS.map((f) => `${f} = v.${f}`).join(", ")}
       FROM (VALUES ${placeholders(slice.length, 15)}) AS v(id, position, ref, ${FIELDS.join(", ")})
       WHERE q.id = v.id::int`,
      slice.flatMap(({ id, position, q }) => [id, position, q.ref, ...fieldValues(q)]),
    );
  }
}

type BuiltinTest = {
  title: string;
  category: string;
  description: string;
  kind: "official" | "practice";
  minutes: number;
  questions: BankQuestion[];
};

/**
 * Creates or updates one built-in test. Existing questions are matched by ref; rows from before refs
 * existed are matched by paper position when the question text is unchanged. Matched rows keep their
 * ids, so attempts that include them keep their answers and results.
 */
async function syncTest(tx: Executor, test: BuiltinTest, position: number) {
  const questionLimit = test.kind === "official" ? test.questions.length : 0;
  const found = await tx.query("SELECT id FROM tests WHERE title = $1 AND builtin = 1", [test.title]);
  if (found.rows.length === 0) {
    const created = await tx.query(
      `INSERT INTO tests (title, category, description, kind, time_limit, question_limit, shuffle, position, builtin)
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, 1) RETURNING id`,
      [test.title, test.category, test.description, test.kind, test.minutes, questionLimit, position],
    );
    await insertQuestions(tx, Number(created.rows[0].id), test.questions.map((q, i) => ({ position: i + 1, q })));
    return;
  }

  // The shuffle setting is left as it is: an admin may have changed it.
  const testId = Number(found.rows[0].id);
  await tx.query(
    `UPDATE tests SET category = $2, description = $3, kind = $4, time_limit = $5, question_limit = $6, position = $7
     WHERE id = $1`,
    [testId, test.category, test.description, test.kind, test.minutes, questionLimit, position],
  );

  const existing = (await tx.query("SELECT id, ref, position, prompt FROM questions WHERE test_id = $1", [testId])).rows;
  const byRef = new Map(existing.filter((r) => r.ref).map((r) => [String(r.ref), r]));
  const byPosition = new Map(existing.filter((r) => !r.ref).map((r) => [Number(r.position), r]));
  const kept = new Set<number>();
  const updates: (Placed & { id: number })[] = [];
  const inserts: Placed[] = [];
  test.questions.forEach((q, i) => {
    let match = byRef.get(q.ref);
    if (!match) {
      const old = byPosition.get(i + 1);
      if (old && old.prompt === q.prompt) match = old;
    }
    const id = match ? Number(match.id) : 0;
    if (id && !kept.has(id)) {
      kept.add(id);
      updates.push({ id, position: i + 1, q });
    } else {
      inserts.push({ position: i + 1, q });
    }
  });

  const removed = existing.map((r) => Number(r.id)).filter((id) => !kept.has(id));
  if (removed.length) await tx.query("DELETE FROM questions WHERE id = ANY($1::int[])", [removed]);
  await updateQuestions(tx, updates);
  await insertQuestions(tx, testId, inserts);
}

/**
 * One-off changes to existing databases, each run once and recorded in meta. They run after
 * seeding, and an admin's later choices are never overwritten because each runs only once.
 */
const UPGRADES: [key: string, sql: string][] = [
  // Mock papers now give each candidate their own question and option order.
  ["upgrade_mock_shuffle", "UPDATE tests SET shuffle = 1 WHERE builtin = 1 AND kind = 'official'"],
];
export const UPGRADE_COUNT = UPGRADES.length;

export async function upgrade(db: Database) {
  for (const [key, sql] of UPGRADES) {
    await db.transaction(async (tx) => {
      const claimed = await tx.query("INSERT INTO meta (key, value) VALUES ($1, '1') ON CONFLICT (key) DO NOTHING", [key]);
      if (claimed.rowCount) await tx.query(sql);
    });
  }
}

export async function seed(db: Database) {
  const current = await db.query("SELECT value FROM meta WHERE key = 'bank_version'");
  if (current.rows[0]?.value === data.version) return;

  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock($1)", [SEED_LOCK]);
    // Another server instance may have installed this version while we waited for the lock.
    const again = await tx.query("SELECT value FROM meta WHERE key = 'bank_version'");
    if (again.rows[0]?.value === data.version) return;

    const admins = await tx.query("SELECT COUNT(*) AS n FROM admins");
    if (Number(admins.rows[0].n) === 0) {
      await tx.query("INSERT INTO admins (username, password_hash) VALUES ($1, $2)", [
        "admin",
        hashPassword(process.env.EPT_ADMIN_PASSWORD || "admin123"),
      ]);
    }

    const byRef = new Map(data.questions.map((q) => [q.ref, q]));
    const tests: BuiltinTest[] = data.mocks
      .map((mock) => ({
        title: mock.title,
        category: "Mock Examination",
        description: mock.description,
        kind: "official" as const,
        minutes: mock.minutes,
        questions: mock.refs.map((ref) => byRef.get(ref)).filter((q): q is BankQuestion => !!q),
      }))
      .filter((t) => t.questions.length > 0);
    tests.push({
      title: data.bank.title,
      category: "Question Bank",
      description: data.bank.description,
      kind: "practice",
      minutes: 0,
      questions: data.questions,
    });

    // Built-in tests that are no longer in the bank go, with their attempts.
    await tx.query("DELETE FROM tests WHERE builtin = 1 AND NOT (title = ANY($1::text[]))", [tests.map((t) => t.title)]);
    for (const [position, test] of tests.entries()) await syncTest(tx, test, position);

    await tx.query(
      "INSERT INTO meta (key, value) VALUES ('bank_version', $1) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [data.version],
    );
  });
}
