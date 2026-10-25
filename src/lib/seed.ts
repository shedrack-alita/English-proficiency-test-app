import type { Client, InStatement } from "@libsql/client";
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
const CHUNK = 200;

const insertQuestion = (testId: number, position: number, q: BankQuestion): InStatement => ({
  sql: `INSERT INTO questions
        (test_id, position, topic, instruction, passage, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation, tip, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [testId, position, q.topic, q.instruction, q.passage, q.prompt, ...q.choices, q.answer, q.explanation, q.tip, q.source],
});

export async function seed(client: Client) {
  const current = await client.execute("SELECT value FROM meta WHERE key = 'bank_version'");
  if (current.rows[0]?.value === data.version) return;

  const tx = await client.transaction("write");
  try {
    // Another server instance may have installed this version while we waited for the lock.
    const again = await tx.execute("SELECT value FROM meta WHERE key = 'bank_version'");
    if (again.rows[0]?.value === data.version) {
      await tx.commit();
      return;
    }

    const admins = await tx.execute("SELECT COUNT(*) AS n FROM admins");
    if (Number(admins.rows[0].n) === 0) {
      await tx.execute({
        sql: "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
        args: ["admin", hashPassword(process.env.EPT_ADMIN_PASSWORD || "admin123")],
      });
    }

    // Replace previous built-in content.
    await tx.batch([
      "DELETE FROM attempt_answers WHERE attempt_id IN (SELECT a.id FROM attempts a JOIN tests t ON t.id = a.test_id WHERE t.builtin = 1)",
      "DELETE FROM attempts WHERE test_id IN (SELECT id FROM tests WHERE builtin = 1)",
      "DELETE FROM questions WHERE test_id IN (SELECT id FROM tests WHERE builtin = 1)",
      "DELETE FROM tests WHERE builtin = 1",
    ]);

    const byRef = new Map(data.questions.map((q) => [q.ref, q]));
    const addTest = async (args: (string | number)[]) => {
      const rs = await tx.execute({
        sql: `INSERT INTO tests (title, category, description, kind, time_limit, question_limit, shuffle, position, builtin)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        args,
      });
      return Number(rs.lastInsertRowid);
    };
    const addQuestions = async (testId: number, list: BankQuestion[]) => {
      for (let i = 0; i < list.length; i += CHUNK) {
        await tx.batch(list.slice(i, i + CHUNK).map((q, j) => insertQuestion(testId, i + j + 1, q)));
      }
    };

    let position = 0;
    for (const mock of data.mocks) {
      const list = mock.refs.map((ref) => byRef.get(ref)).filter((q): q is BankQuestion => !!q);
      if (list.length === 0) continue;
      const id = await addTest([mock.title, "Mock Examination", mock.description, "official", mock.minutes, list.length, 0, position++]);
      await addQuestions(id, list);
    }
    const bankId = await addTest([data.bank.title, "Question Bank", data.bank.description, "practice", 0, 0, 1, position++]);
    await addQuestions(bankId, data.questions);

    await tx.execute({
      sql: "INSERT INTO meta (key, value) VALUES ('bank_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      args: [data.version],
    });
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
