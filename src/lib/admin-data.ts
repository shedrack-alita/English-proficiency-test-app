import "server-only";
import { all, get, run, transaction } from "./db";
import { PASS_MARK, percent, type CandidateAccess, type TestKind } from "./constants";
import { parseCsv } from "./csv";
import type { Letter } from "./data";

export class AdminError extends Error {}

const LETTERS: Letter[] = ["A", "B", "C", "D"];

/* ------------------------------------------------------------------ */
/* Admin accounts                                                      */
/* ------------------------------------------------------------------ */

export async function getAdmin(id: number) {
  const r = await get("SELECT id, username FROM admins WHERE id = ?", [id]);
  return r ? { id: Number(r.id), username: String(r.username) } : null;
}

export async function findAdmin(username: string) {
  const r = await get("SELECT * FROM admins WHERE username = ?", [username]);
  return r ? { id: Number(r.id), username: String(r.username), passwordHash: String(r.password_hash) } : null;
}

export async function getAdminPasswordHash(id: number) {
  const r = await get("SELECT password_hash FROM admins WHERE id = ?", [id]);
  return r ? String(r.password_hash) : null;
}

export async function setAdminPassword(id: number, passwordHash: string) {
  await run("UPDATE admins SET password_hash = ? WHERE id = ?", [passwordHash, id]);
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export type ResultRow = {
  id: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  testId: number;
  testTitle: string;
  kind: TestKind;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  submittedAt: number;
};

function toResult(r: Record<string, unknown>): ResultRow {
  const score = Number(r.score);
  const total = Number(r.total);
  const percentage = percent(score, total);
  return {
    id: Number(r.id),
    candidateId: Number(r.candidate_id),
    candidateName: String(r.full_name),
    candidateEmail: String(r.email),
    testId: Number(r.test_id),
    testTitle: String(r.title),
    kind: r.kind as TestKind,
    score,
    total,
    percentage,
    passed: percentage >= PASS_MARK,
    submittedAt: Number(r.submitted_at),
  };
}

const RESULT_SELECT = `
  SELECT a.id, a.candidate_id, a.test_id, a.score, a.total, a.submitted_at,
         c.full_name, c.email, t.title, t.kind
  FROM attempts a
  JOIN candidates c ON c.id = a.candidate_id
  JOIN tests t ON t.id = a.test_id
  WHERE a.submitted_at IS NOT NULL`;

export async function getOverview() {
  const [counts, recent, topics] = await Promise.all([
    get(`SELECT
           (SELECT COUNT(*) FROM candidates) AS candidates,
           (SELECT COUNT(*) FROM tests) AS tests,
           (SELECT COALESCE(MAX(n), 0) FROM (
              SELECT COUNT(*) AS n FROM questions q JOIN tests t ON t.id = q.test_id WHERE t.kind = 'practice' GROUP BY t.id
            ) s) AS bank,
           (SELECT COUNT(*) FROM attempts WHERE submitted_at IS NOT NULL) AS attempts,
           (SELECT COUNT(*) FROM attempts WHERE submitted_at IS NOT NULL AND score * 100.0 >= total * ${PASS_MARK}) AS passed,
           (SELECT AVG(score * 100.0 / total) FROM attempts WHERE submitted_at IS NOT NULL AND total > 0) AS avg_pct,
           (SELECT COUNT(*) FROM attempts WHERE submitted_at IS NULL AND expires_at > ?) AS in_progress,
           (SELECT COUNT(*) FROM feedbacks) AS feedbacks`, [Date.now()]),
    all(`${RESULT_SELECT} ORDER BY a.submitted_at DESC LIMIT 8`),
    all(`SELECT q.topic, COUNT(*) AS total, SUM(CASE WHEN aa.choice = q.answer THEN 1 ELSE 0 END) AS correct
         FROM attempts a
         CROSS JOIN LATERAL jsonb_array_elements_text(a.question_ids::jsonb) AS j(value)
         JOIN questions q ON q.id = j.value::int
         LEFT JOIN attempt_answers aa ON aa.attempt_id = a.id AND aa.question_id = q.id
         WHERE a.submitted_at IS NOT NULL
         GROUP BY q.topic
         ORDER BY MIN(q.position)`),
  ]);
  const attempts = Number(counts!.attempts);
  return {
    candidates: Number(counts!.candidates),
    tests: Number(counts!.tests),
    bank: Number(counts!.bank),
    attempts,
    inProgress: Number(counts!.in_progress),
    feedbacks: Number(counts!.feedbacks),
    passRate: attempts ? percent(Number(counts!.passed), attempts) : 0,
    avgScore: counts!.avg_pct == null ? 0 : Math.round(Number(counts!.avg_pct) * 10) / 10,
    recent: recent.map(toResult),
    topics: topics.map((t) => ({
      topic: String(t.topic),
      answered: Number(t.total),
      percentage: percent(Number(t.correct), Number(t.total)),
    })),
  };
}

/** Sign-up numbers. created_at is stored as a UTC "YYYY-MM-DD HH:MM:SS" string, so its first 10 characters are the day. */
/** SQL for the UTC date `daysAgo` days before today, as "YYYY-MM-DD". */
const utcDay = (daysAgo: number) =>
  `to_char((now() AT TIME ZONE 'UTC')::date - ${Math.floor(daysAgo)}, 'YYYY-MM-DD')`;

export async function getSignupStats(days = 14) {
  const [counts, daily] = await Promise.all([
    get(`SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE left(created_at, 10) >= ${utcDay(0)}) AS today,
           COUNT(*) FILTER (WHERE left(created_at, 10) >= ${utcDay(6)}) AS week,
           COUNT(*) FILTER (WHERE left(created_at, 10) >= ${utcDay(29)}) AS month,
           (SELECT COUNT(DISTINCT candidate_id) FROM attempts WHERE submitted_at IS NOT NULL) AS tested
         FROM candidates`),
    all(
      `SELECT left(created_at, 10) AS day, COUNT(*) AS n FROM candidates
       WHERE left(created_at, 10) >= ${utcDay(days - 1)} GROUP BY 1`,
    ),
  ]);
  const byDay = new Map(daily.map((r) => [String(r.day), Number(r.n)]));
  const today = new Date();
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (days - 1 - i)));
    const day = d.toISOString().slice(0, 10);
    return { day, count: byDay.get(day) ?? 0 };
  });
  return {
    total: Number(counts!.total),
    today: Number(counts!.today ?? 0),
    week: Number(counts!.week ?? 0),
    month: Number(counts!.month ?? 0),
    tested: Number(counts!.tested),
    series,
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

export type TestInput = {
  title: string;
  category: string;
  description: string;
  kind: TestKind;
  timeLimit: number;
  questionLimit: number;
  shuffle: boolean;
};

export async function getAttemptCounts() {
  const rows = await all("SELECT test_id, COUNT(*) AS n FROM attempts WHERE submitted_at IS NOT NULL GROUP BY test_id");
  return new Map(rows.map((r) => [Number(r.test_id), Number(r.n)]));
}

async function assertUniqueTitle(title: string, exceptId = 0) {
  if (await get("SELECT 1 FROM tests WHERE title = ? AND id != ?", [title, exceptId])) {
    throw new AdminError("Another test already uses that title.");
  }
}

export async function createTest(input: TestInput) {
  await assertUniqueTitle(input.title);
  const created = await get(
    `INSERT INTO tests (title, category, description, kind, time_limit, question_limit, shuffle, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM tests)) RETURNING id`,
    [input.title, input.category, input.description, input.kind, input.timeLimit, input.questionLimit, input.shuffle ? 1 : 0],
  );
  return Number(created!.id);
}

export async function updateTest(id: number, input: TestInput) {
  await assertUniqueTitle(input.title, id);
  await run(
    `UPDATE tests SET title = ?, category = ?, description = ?, kind = ?, time_limit = ?, question_limit = ?, shuffle = ?
     WHERE id = ?`,
    [input.title, input.category, input.description, input.kind, input.timeLimit, input.questionLimit, input.shuffle ? 1 : 0, id],
  );
}

/** Deletes a test with its questions, attempts and answers. */
export async function deleteTest(id: number) {
  await transaction(async (tx) => {
    await run("DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM attempts WHERE test_id = ?)", [id], tx);
    await run("DELETE FROM attempts WHERE test_id = ?", [id], tx);
    await run("DELETE FROM questions WHERE test_id = ?", [id], tx);
    await run("DELETE FROM tests WHERE id = ?", [id], tx);
  });
}

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

export type QuestionInput = {
  topic: string;
  instruction: string;
  passage: string;
  prompt: string;
  choices: Record<Letter, string>;
  answer: Letter;
  explanation: string;
  tip: string;
  source: string;
};

export type AdminQuestion = QuestionInput & { id: number; testId: number; position: number };

function toQuestion(r: Record<string, unknown>): AdminQuestion {
  return {
    id: Number(r.id),
    testId: Number(r.test_id),
    position: Number(r.position),
    topic: String(r.topic),
    instruction: String(r.instruction),
    passage: String(r.passage),
    prompt: String(r.prompt),
    choices: { A: String(r.choice_a), B: String(r.choice_b), C: String(r.choice_c), D: String(r.choice_d) },
    answer: r.answer as Letter,
    explanation: String(r.explanation ?? ""),
    tip: String(r.tip ?? ""),
    source: String(r.source ?? ""),
  };
}

export const QUESTIONS_PER_PAGE = 25;

/** One page of a test's questions, optionally narrowed to a topic and a search term. */
export async function listQuestions(testId: number, filter: { topic?: string; search?: string; page?: number } = {}) {
  const where = ["test_id = ?"];
  const args: (string | number)[] = [testId];
  if (filter.topic) {
    where.push("topic = ?");
    args.push(filter.topic);
  }
  const search = filter.search?.trim();
  if (search) {
    where.push(`(prompt ILIKE ? OR instruction ILIKE ? OR passage ILIKE ? OR choice_a ILIKE ? OR choice_b ILIKE ?
                 OR choice_c ILIKE ? OR choice_d ILIKE ? OR source ILIKE ?)`);
    args.push(...Array<string>(8).fill(`%${search}%`));
  }
  const clause = where.join(" AND ");
  const [count, topicRows] = await Promise.all([
    get(`SELECT COUNT(*) AS n FROM questions WHERE ${clause}`, args),
    all("SELECT topic, COUNT(*) AS n FROM questions WHERE test_id = ? GROUP BY topic ORDER BY MIN(position)", [testId]),
  ]);
  const total = Number(count!.n);
  const pages = Math.max(1, Math.ceil(total / QUESTIONS_PER_PAGE));
  const page = Math.min(Math.max(1, Math.floor(filter.page ?? 1)), pages);
  const rows = await all(`SELECT * FROM questions WHERE ${clause} ORDER BY position, id LIMIT ? OFFSET ?`, [
    ...args,
    QUESTIONS_PER_PAGE,
    (page - 1) * QUESTIONS_PER_PAGE,
  ]);
  return {
    items: rows.map(toQuestion),
    total,
    page,
    pages,
    topics: topicRows.map((r) => ({ topic: String(r.topic), count: Number(r.n) })),
  };
}

export async function getQuestion(id: number) {
  const r = await get("SELECT * FROM questions WHERE id = ?", [id]);
  return r ? toQuestion(r) : null;
}

export async function getTopics() {
  return (await all("SELECT topic FROM questions WHERE topic != '' GROUP BY topic ORDER BY MIN(position)")).map((r) =>
    String(r.topic),
  );
}

export function validateQuestion(q: QuestionInput): string | null {
  if (!q.prompt.trim() && !q.instruction.trim()) return "Enter the question text (or an instruction).";
  for (const k of LETTERS) if (!q.choices[k].trim()) return `Option ${k.toLowerCase()} is empty.`;
  if (!LETTERS.includes(q.answer)) return "Choose the correct answer.";
  const texts = LETTERS.map((k) => q.choices[k].trim().toLowerCase());
  if (new Set(texts).size !== 4) return "The four options must all be different.";
  return null;
}

const QUESTION_INSERT = `INSERT INTO questions
  (test_id, position, topic, instruction, passage, prompt, choice_a, choice_b, choice_c, choice_d, answer, explanation, tip, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function questionArgs(testId: number, position: number, q: QuestionInput) {
  return [
    testId,
    position,
    q.topic.trim(),
    q.instruction.trim(),
    q.passage.trim(),
    q.prompt.trim(),
    q.choices.A.trim(),
    q.choices.B.trim(),
    q.choices.C.trim(),
    q.choices.D.trim(),
    q.answer,
    q.explanation.trim(),
    q.tip.trim(),
    q.source.trim(),
  ];
}

async function nextPosition(testId: number) {
  const r = await get("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM questions WHERE test_id = ?", [testId]);
  return Number(r!.p);
}

export async function createQuestion(testId: number, q: QuestionInput) {
  const error = validateQuestion(q);
  if (error) throw new AdminError(error);
  await run(QUESTION_INSERT, questionArgs(testId, await nextPosition(testId), q));
}

export async function updateQuestion(id: number, q: QuestionInput) {
  const error = validateQuestion(q);
  if (error) throw new AdminError(error);
  await run(
    `UPDATE questions SET topic = ?, instruction = ?, passage = ?, prompt = ?,
       choice_a = ?, choice_b = ?, choice_c = ?, choice_d = ?, answer = ?, explanation = ?, tip = ?, source = ?
     WHERE id = ?`,
    [...questionArgs(0, 0, q).slice(2), id],
  );
}

export async function deleteQuestion(id: number) {
  await run("DELETE FROM questions WHERE id = ?", [id]);
}

/** Maps a CSV answer ("A", "b", or the option text itself) to a letter. */
function normalizeAnswer(raw: string, choices: Record<Letter, string>): Letter | null {
  const value = raw.trim();
  const upper = value.toUpperCase().replace(/[.)]$/, "");
  if ((LETTERS as string[]).includes(upper)) return upper as Letter;
  return LETTERS.find((k) => choices[k].trim().toLowerCase() === value.toLowerCase()) ?? null;
}

const HEADER_ALIASES: Record<string, string> = {
  question: "prompt",
  prompt: "prompt",
  choice_a: "A",
  option_a: "A",
  a: "A",
  choice_b: "B",
  option_b: "B",
  b: "B",
  choice_c: "C",
  option_c: "C",
  c: "C",
  choice_d: "D",
  option_d: "D",
  d: "D",
  correct_answer: "answer",
  answer: "answer",
  correct: "answer",
  topic: "topic",
  instruction: "instruction",
  passage: "passage",
  explanation: "explanation",
  tip: "tip",
  source: "source",
};

/**
 * Imports questions from CSV. Columns (header optional, in this order when absent):
 * question, choice_a, choice_b, choice_c, choice_d, correct_answer, [topic, instruction, passage, explanation, tip, source]
 */
export async function importQuestionsCsv(testId: number, text: string, defaultTopic: string) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new AdminError("The file is empty.");

  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/\s+/g, "_")]);
  const hasHeader = header.includes("prompt") && header.includes("answer");
  const columns = hasHeader
    ? header
    : ["prompt", "A", "B", "C", "D", "answer", "topic", "instruction", "passage", "explanation", "tip", "source"];
  const body = hasHeader ? rows.slice(1) : rows;

  const current = await all("SELECT prompt, topic FROM questions WHERE test_id = ?", [testId]);
  const existing = new Set(current.map((r) => String(r.prompt).trim().toLowerCase()));
  // Rows without a topic join the test's topic when the test covers exactly one.
  const testTopics = [...new Set(current.map((r) => String(r.topic)).filter(Boolean))];
  if (!defaultTopic && testTopics.length === 1) defaultTopic = testTopics[0];
  let position = await nextPosition(testId);
  const stmts: { sql: string; args: (string | number)[] }[] = [];
  const problems: string[] = [];
  let duplicates = 0;

  body.forEach((cells, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const cell = (name: string) => {
      const idx = columns.indexOf(name);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };
    const choices = { A: cell("A"), B: cell("B"), C: cell("C"), D: cell("D") };
    const answer = normalizeAnswer(cell("answer"), choices);
    const q: QuestionInput = {
      topic: cell("topic") || defaultTopic,
      instruction: cell("instruction"),
      passage: cell("passage"),
      prompt: cell("prompt"),
      choices,
      answer: answer ?? ("" as Letter),
      explanation: cell("explanation"),
      tip: cell("tip"),
      source: cell("source"),
    };
    const error = answer ? validateQuestion(q) : "the correct answer must be A–D or match one of the options";
    if (error) {
      if (problems.length < 8) problems.push(`Row ${line}: ${error.charAt(0).toLowerCase()}${error.slice(1)}`);
      return;
    }
    const key = q.prompt.trim().toLowerCase();
    if (key && existing.has(key)) {
      duplicates++;
      return;
    }
    if (key) existing.add(key);
    stmts.push({ sql: QUESTION_INSERT, args: questionArgs(testId, position++, q) });
  });

  if (stmts.length > 0) {
    await transaction(async (tx) => {
      for (const s of stmts) await run(s.sql, s.args, tx);
    });
  }
  const skipped = body.length - stmts.length;
  return { inserted: stmts.length, skipped, duplicates, problems };
}

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

export type CandidateRow = {
  id: number;
  fullName: string;
  email: string;
  course: string;
  department: string;
  gender: string;
  access: CandidateAccess;
  status: string;
  createdAt: string;
  attempts: number;
  avgScore: number | null;
  lastActive: number | null;
};

export async function listCandidates(search = "") {
  const q = `%${search.trim()}%`;
  const rows = await all(
    `SELECT c.*,
            COUNT(a.id) AS attempts,
            AVG(CASE WHEN a.total > 0 THEN a.score * 100.0 / a.total END) AS avg_pct,
            MAX(a.submitted_at) AS last_active
     FROM candidates c
     LEFT JOIN attempts a ON a.candidate_id = c.id AND a.submitted_at IS NOT NULL
     WHERE c.full_name ILIKE ? OR c.email ILIKE ? OR c.course ILIKE ? OR c.department ILIKE ?
     GROUP BY c.id
     ORDER BY c.id DESC`,
    [q, q, q, q],
  );
  return rows.map(
    (r): CandidateRow => ({
      id: Number(r.id),
      fullName: String(r.full_name),
      email: String(r.email),
      course: String(r.course ?? ""),
      department: String(r.department ?? ""),
      gender: String(r.gender ?? ""),
      access: r.access as CandidateAccess,
      status: String(r.status),
      createdAt: String(r.created_at),
      attempts: Number(r.attempts),
      avgScore: r.avg_pct == null ? null : Math.round(Number(r.avg_pct) * 10) / 10,
      lastActive: r.last_active == null ? null : Number(r.last_active),
    }),
  );
}

export async function updateCandidate(
  id: number,
  input: {
    fullName: string;
    email: string;
    course: string;
    department: string;
    gender: string;
    access: CandidateAccess;
    status: string;
  },
) {
  if (await get("SELECT 1 FROM candidates WHERE email = ? AND id != ?", [input.email, id])) {
    throw new AdminError("Another candidate already uses that email.");
  }
  await run(
    "UPDATE candidates SET full_name = ?, email = ?, course = ?, department = ?, gender = ?, access = ?, status = ? WHERE id = ?",
    [input.fullName, input.email, input.course, input.department, input.gender, input.access, input.status, id],
  );
}

/** Deletes a candidate with their attempts, answers and feedback. */
export async function deleteCandidate(id: number) {
  await transaction(async (tx) => {
    await run("DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM attempts WHERE candidate_id = ?)", [id], tx);
    await run("DELETE FROM attempts WHERE candidate_id = ?", [id], tx);
    await run("DELETE FROM feedbacks WHERE candidate_id = ?", [id], tx);
    await run("DELETE FROM candidates WHERE id = ?", [id], tx);
  });
}

/** Lets a candidate retake an official test by removing their attempts at it. */
export async function resetAttempts(candidateId: number, testId: number) {
  await transaction(async (tx) => {
    await run(
      "DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM attempts WHERE candidate_id = ? AND test_id = ?)",
      [candidateId, testId],
      tx,
    );
    await run("DELETE FROM attempts WHERE candidate_id = ? AND test_id = ?", [candidateId, testId], tx);
  });
}

/* ------------------------------------------------------------------ */
/* Results, rankings, feedback                                         */
/* ------------------------------------------------------------------ */

export async function listResults(filter: { testId?: number; candidateId?: number } = {}) {
  const where: string[] = [];
  const args: number[] = [];
  if (filter.testId) {
    where.push("a.test_id = ?");
    args.push(filter.testId);
  }
  if (filter.candidateId) {
    where.push("a.candidate_id = ?");
    args.push(filter.candidateId);
  }
  const extra = where.length ? ` AND ${where.join(" AND ")}` : "";
  return (await all(`${RESULT_SELECT}${extra} ORDER BY a.submitted_at DESC LIMIT 500`, args)).map(toResult);
}

/** Each candidate's best submitted score on a test, highest first. */
export async function getRanking(testId: number) {
  const rows = await all(
    `${RESULT_SELECT} AND a.test_id = ?
     ORDER BY a.candidate_id, (a.score * 1.0 / NULLIF(a.total, 0)) DESC NULLS LAST, a.submitted_at ASC`,
    [testId],
  );
  const best = new Map<number, ResultRow>();
  for (const r of rows.map(toResult)) if (!best.has(r.candidateId)) best.set(r.candidateId, r);
  return [...best.values()].sort((a, b) => b.percentage - a.percentage || a.submittedAt - b.submittedAt);
}

export async function listAllFeedback() {
  const rows = await all(
    `SELECT f.id, f.display_name, f.message, f.created_at, c.full_name, c.email
     FROM feedbacks f LEFT JOIN candidates c ON c.id = f.candidate_id
     ORDER BY f.id DESC`,
  );
  return rows.map((r) => {
    // Feedback sent anonymously stays anonymous to admins too.
    const anonymous = r.display_name === "Anonymous";
    return {
      id: Number(r.id),
      displayName: String(r.display_name),
      message: String(r.message),
      createdAt: String(r.created_at),
      candidateEmail: anonymous || r.email == null ? null : String(r.email),
    };
  });
}

export async function deleteFeedback(id: number) {
  await run("DELETE FROM feedbacks WHERE id = ?", [id]);
}
