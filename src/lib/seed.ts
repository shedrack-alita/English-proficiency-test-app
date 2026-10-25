import type { Database, Executor } from "./db";
import { hashPassword } from "./password";
import bank from "./seed-data/bank.json";

/**
 * Built-in content: the question bank and the mock papers, generated into seed-data/bank.json
 * by scripts/build-bank.mjs from the files in content/. Each build has a version; when it changes,
 * built-in tests are replaced (with their attempts) and tests created in the admin panel are kept.
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

/** Rows per INSERT: 14 columns each, well under Postgres's parameter limit. */
const CHUNK = 100;
const COLUMNS = 14;
/** Any fixed number; serialises seeding when several server instances start at once. */
const SEED_LOCK = 7_310_001;

async function insertQuestions(tx: Executor, testId: number, list: BankQuestion[]) {
  for (let i = 0; i < list.length; i += CHUNK) {
    const slice = list.slice(i, i + CHUNK);
    const values = slice
      .map((_, r) => `(${Array.from({ length: COLUMNS }, (_, c) => `$${r * COLUMNS + c + 1}`).join(", ")})`)
      .join(",\n");
    const params = slice.flatMap((q, j) => [
      testId,
      i + j + 1,
      q.topic,
      q.instruction,
      q.passage,
      q.prompt,
      ...q.choices,
      q.answer,
      q.explanation,
      q.tip,
      q.source,
    ]);
    await tx.query(
      `INSERT INTO questions
       (test_id, position, topic, instruction, passage, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation, tip, source)
       VALUES ${values}`,
      params,
    );
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

    // Replace previous built-in content.
    await tx.query(
      "DELETE FROM attempt_answers WHERE attempt_id IN (SELECT a.id FROM attempts a JOIN tests t ON t.id = a.test_id WHERE t.builtin = 1)",
    );
    await tx.query("DELETE FROM attempts WHERE test_id IN (SELECT id FROM tests WHERE builtin = 1)");
    await tx.query("DELETE FROM questions WHERE test_id IN (SELECT id FROM tests WHERE builtin = 1)");
    await tx.query("DELETE FROM tests WHERE builtin = 1");

    const byRef = new Map(data.questions.map((q) => [q.ref, q]));
    const addTest = async (params: (string | number)[]) => {
      const rs = await tx.query(
        `INSERT INTO tests (title, category, description, kind, time_limit, question_limit, shuffle, position, builtin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1) RETURNING id`,
        params,
      );
      return Number(rs.rows[0].id);
    };

    let position = 0;
    for (const mock of data.mocks) {
      const list = mock.refs.map((ref) => byRef.get(ref)).filter((q): q is BankQuestion => !!q);
      if (list.length === 0) continue;
      const id = await addTest([mock.title, "Mock Examination", mock.description, "official", mock.minutes, list.length, 0, position++]);
      await insertQuestions(tx, id, list);
    }
    const bankId = await addTest([data.bank.title, "Question Bank", data.bank.description, "practice", 0, 0, 1, position++]);
    await insertQuestions(tx, bankId, data.questions);

    await tx.query(
      "INSERT INTO meta (key, value) VALUES ('bank_version', $1) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      [data.version],
    );
  });
}
