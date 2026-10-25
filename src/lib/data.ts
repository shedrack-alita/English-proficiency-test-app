import "server-only";
import { all, get, run, transaction, type Executor, type Row } from "./db";
import {
  MAX_FEEDBACKS,
  PASS_MARK,
  SUBMIT_GRACE_SECONDS,
  percent,
  type CandidateAccess,
  type TestKind,
} from "./constants";

const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

export type Candidate = {
  id: number;
  fullName: string;
  email: string;
  course: string;
  department: string;
  gender: string;
  access: CandidateAccess;
  status: string;
};

function toCandidate(r: Row): Candidate {
  return {
    id: Number(r.id),
    fullName: String(r.full_name),
    email: String(r.email),
    course: String(r.course ?? ""),
    department: String(r.department ?? ""),
    gender: String(r.gender ?? ""),
    access: r.access as CandidateAccess,
    status: String(r.status),
  };
}

export async function getCandidate(id: number) {
  const r = await get("SELECT * FROM candidates WHERE id = ?", [id]);
  return r ? toCandidate(r) : null;
}

export async function findCandidateForLogin(email: string) {
  const r = await get("SELECT * FROM candidates WHERE email = lower(?::text)", [email]);
  return r ? { ...toCandidate(r), passwordHash: String(r.password_hash) } : null;
}

export type SignupProfile = { fullName: string; email: string; course: string; department: string; gender: string };

/** Registers a candidate; returns null when the email is already taken. */
export async function createCandidate(profile: SignupProfile, passwordHash: string) {
  const { rowsAffected } = await run(
    `INSERT INTO candidates (full_name, email, course, department, gender, password_hash) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (email) DO NOTHING`,
    [profile.fullName, profile.email, profile.course, profile.department, profile.gender, passwordHash],
  );
  return rowsAffected ? findCandidateForLogin(profile.email) : null;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

export type TestSummary = {
  id: number;
  title: string;
  category: string;
  description: string;
  kind: TestKind;
  timeLimit: number;
  questionLimit: number;
  shuffle: boolean;
  questionCount: number;
  topics: string[];
};

const TEST_SELECT = `
  SELECT t.*,
         (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS question_count,
         (SELECT COALESCE(json_agg(s.topic ORDER BY s.p), '[]')::text FROM (
            SELECT topic, MIN(position) AS p FROM questions q WHERE q.test_id = t.id GROUP BY topic
          ) s) AS topics
  FROM tests t`;

function toTest(r: Row): TestSummary {
  return {
    id: Number(r.id),
    title: String(r.title),
    category: String(r.category),
    description: String(r.description),
    kind: r.kind as TestKind,
    timeLimit: Number(r.time_limit),
    questionLimit: Number(r.question_limit),
    shuffle: Number(r.shuffle) === 1,
    questionCount: Number(r.question_count),
    topics: JSON.parse(String(r.topics ?? "[]")) as string[],
  };
}

function kindsFor(access: CandidateAccess): TestKind[] {
  return access === "both" ? ["official", "practice"] : [access];
}

export function canAccess(candidate: Candidate, test: TestSummary) {
  return kindsFor(candidate.access).includes(test.kind) && test.questionCount > 0;
}

/** Number of questions an official test actually shows. */
export function officialQuestionCount(test: TestSummary) {
  return Math.min(test.questionLimit, test.questionCount);
}

export async function getTest(id: number) {
  const r = await get(`${TEST_SELECT} WHERE t.id = ?`, [id]);
  return r ? toTest(r) : null;
}

/** Question count per topic for a test, in paper order. */
export async function getTopicCounts(testId: number) {
  const rows = await all(
    "SELECT topic, COUNT(*) AS n FROM questions WHERE test_id = ? GROUP BY topic ORDER BY MIN(position)",
    [testId],
  );
  return rows.map((r) => ({ topic: String(r.topic), count: Number(r.n) }));
}

/** The practice test holding the full question bank (the practice test with the most questions). */
export async function getBankTest() {
  const r = await get(
    `${TEST_SELECT} WHERE t.kind = 'practice' ORDER BY question_count DESC, t.position LIMIT 1`,
  );
  return r ? toTest(r) : null;
}

export async function getBankStats() {
  const [bank, mocks] = await Promise.all([
    getBankTest(),
    get("SELECT COUNT(*) AS n FROM tests WHERE kind = 'official'"),
  ]);
  return {
    questions: bank?.questionCount ?? 0,
    topics: bank?.topics.length ?? 0,
    mocks: Number(mocks?.n ?? 0),
  };
}

export async function getAllTests() {
  const rows = await all(`${TEST_SELECT} ORDER BY t.position, t.id`);
  return rows.map(toTest);
}

export async function getAvailableTests(candidate: Candidate) {
  return (await getAllTests()).filter((t) => canAccess(candidate, t));
}

/* ------------------------------------------------------------------ */
/* Attempts                                                            */
/* ------------------------------------------------------------------ */

export type AttemptRow = {
  id: number;
  candidateId: number;
  testId: number;
  questionIds: number[];
  startedAt: number;
  expiresAt: number;
  submittedAt: number | null;
  score: number | null;
  total: number;
};

function toAttempt(r: Row): AttemptRow {
  return {
    id: Number(r.id),
    candidateId: Number(r.candidate_id),
    testId: Number(r.test_id),
    questionIds: JSON.parse(String(r.question_ids)) as number[],
    startedAt: Number(r.started_at),
    expiresAt: Number(r.expires_at),
    submittedAt: r.submitted_at == null ? null : Number(r.submitted_at),
    score: r.score == null ? null : Number(r.score),
    total: Number(r.total),
  };
}

const graceMs = SUBMIT_GRACE_SECONDS * 1000;

export async function getAttempt(id: number) {
  const r = await get("SELECT * FROM attempts WHERE id = ?", [id]);
  return r ? toAttempt(r) : null;
}

export function isOpen(a: AttemptRow, now = Date.now()) {
  return a.submittedAt === null && now <= a.expiresAt + graceMs;
}

async function hasSubmittedAttempt(candidateId: number, testId: number, ex?: Executor) {
  return !!(await get(
    "SELECT 1 FROM attempts WHERE candidate_id = ? AND test_id = ? AND submitted_at IS NOT NULL LIMIT 1",
    [candidateId, testId],
    ex,
  ));
}

export async function latestSubmittedAttemptId(candidateId: number, testId: number) {
  const r = await get(
    "SELECT id FROM attempts WHERE candidate_id = ? AND test_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 1",
    [candidateId, testId],
  );
  return r ? Number(r.id) : null;
}

export async function findOpenAttempt(candidateId: number, testId: number, ex?: Executor) {
  const rows = await all(
    "SELECT * FROM attempts WHERE candidate_id = ? AND test_id = ? AND submitted_at IS NULL ORDER BY id DESC",
    [candidateId, testId],
    ex,
  );
  return rows.map(toAttempt).find((a) => isOpen(a)) ?? null;
}

/** Scores an attempt and marks it submitted. Safe to call more than once. */
export async function finalizeAttempt(attemptId: number) {
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.submittedAt !== null) return;
  await run(
    `UPDATE attempts SET
       submitted_at = ?,
       score = (SELECT COUNT(*) FROM attempt_answers aa
                JOIN questions q ON q.id = aa.question_id AND q.answer = aa.choice
                WHERE aa.attempt_id = attempts.id
                  AND aa.question_id IN (SELECT value::int FROM jsonb_array_elements_text(attempts.question_ids::jsonb)))
     WHERE id = ? AND submitted_at IS NULL`,
    [Math.min(Date.now(), attempt.expiresAt), attemptId],
  );
}

/**
 * Closes attempts whose timer ran out without a submission. Official attempts are scored with
 * whatever was answered; abandoned practice attempts with no answers are discarded.
 */
export async function closeExpiredAttempts(candidateId: number) {
  const rows = await all(
    `SELECT a.id, t.kind, (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = a.id) AS answered
     FROM attempts a JOIN tests t ON t.id = a.test_id
     WHERE a.candidate_id = ? AND a.submitted_at IS NULL AND a.expires_at < ?`,
    [candidateId, Date.now() - graceMs],
  );
  for (const r of rows) {
    if (r.kind === "practice" && Number(r.answered) === 0) {
      await run("DELETE FROM attempts WHERE id = ?", [Number(r.id)]);
    } else {
      await finalizeAttempt(Number(r.id));
    }
  }
}

export class AttemptError extends Error {}

export async function startAttempt(
  candidate: Candidate,
  test: TestSummary,
  practice?: { minutes: number; questions: number; topics?: string[] },
) {
  return transaction(async (tx) => {
    let minutes: number;
    let count: number;
    if (test.kind === "official") {
      if (await hasSubmittedAttempt(candidate.id, test.id, tx)) throw new AttemptError("You have already taken this test.");
      const open = await findOpenAttempt(candidate.id, test.id, tx);
      if (open) return open.id; // resume instead of re-rolling questions
      minutes = test.timeLimit;
      count = officialQuestionCount(test);
    } else {
      if (!practice) throw new AttemptError("Choose a time limit and number of questions.");
      minutes = practice.minutes;
      count = practice.questions;
    }
    if (minutes <= 0 || count <= 0) throw new AttemptError("This test is not fully configured yet.");

    // Shuffled tests draw a random set; ordered tests (the full paper) keep paper order.
    const order = test.shuffle ? "RANDOM()" : "position, id";
    const topics = practice?.topics?.length ? practice.topics : null;
    const topicFilter = topics ? `AND topic IN (${topics.map(() => "?").join(",")})` : "";
    const ids = (
      await all(
        `SELECT id FROM questions WHERE test_id = ? ${topicFilter} ORDER BY ${order} LIMIT ?`,
        [test.id, ...(topics ?? []), count],
        tx,
      )
    ).map((r) => Number(r.id));
    if (ids.length === 0) throw new AttemptError("No questions match the topics you chose.");

    const now = Date.now();
    const created = await get(
      `INSERT INTO attempts (candidate_id, test_id, question_ids, started_at, expires_at, total)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [candidate.id, test.id, JSON.stringify(ids), now, now + minutes * 60_000, ids.length],
      tx,
    );
    return Number(created!.id);
  });
}

export async function saveAnswer(candidateId: number, attemptId: number, questionId: number, choice: Letter) {
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.candidateId !== candidateId) throw new AttemptError("Attempt not found.");
  if (!isOpen(attempt)) throw new AttemptError("Time is up for this attempt.");
  if (!attempt.questionIds.includes(questionId)) throw new AttemptError("Question is not part of this attempt.");
  await run(
    `INSERT INTO attempt_answers (attempt_id, question_id, choice) VALUES (?, ?, ?)
     ON CONFLICT (attempt_id, question_id) DO UPDATE SET choice = excluded.choice`,
    [attemptId, questionId, choice],
  );
}

/* Deterministic shuffle so choices keep their order across page reloads. */
function seededOrder(seed: number) {
  const order: Letter[] = [...LETTERS];
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

type QuestionRow = {
  id: number;
  number: number;
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

async function loadQuestions(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = await all(
    "SELECT * FROM questions WHERE id IN (SELECT value::int FROM jsonb_array_elements_text(?::jsonb))",
    [JSON.stringify(ids)],
  );
  const byId = new Map<number, QuestionRow>(
    rows.map((r) => [
      Number(r.id),
      {
        id: Number(r.id),
        number: Number(r.position),
        topic: String(r.topic),
        instruction: String(r.instruction),
        passage: String(r.passage),
        prompt: String(r.prompt),
        choices: { A: String(r.choice_a), B: String(r.choice_b), C: String(r.choice_c), D: String(r.choice_d) },
        answer: r.answer as Letter,
        explanation: String(r.explanation ?? ""),
        tip: String(r.tip ?? ""),
        source: String(r.source ?? ""),
      },
    ]),
  );
  // Keep the attempt's order; skip questions deleted since the attempt started.
  return ids.map((id) => byId.get(id)).filter((q): q is QuestionRow => !!q);
}

async function savedAnswers(attemptId: number) {
  const rows = await all("SELECT question_id, choice FROM attempt_answers WHERE attempt_id = ?", [attemptId]);
  return Object.fromEntries(rows.map((r) => [Number(r.question_id), r.choice as Letter])) as Record<number, Letter>;
}

/** Orders questions so each topic's questions sit together, topics in order of first appearance. */
function groupByTopic<T extends { topic: string }>(items: T[]) {
  const firstSeen = new Map<string, number>();
  items.forEach((q, i) => {
    if (!firstSeen.has(q.topic)) firstSeen.set(q.topic, i);
  });
  return [...items].sort((a, b) => firstSeen.get(a.topic)! - firstSeen.get(b.topic)!);
}

export type ExamQuestion = {
  id: number;
  number: number;
  topic: string;
  instruction: string;
  passage: string;
  prompt: string;
  options: { key: Letter; text: string }[];
};

/** Everything the exam screen needs — never includes correct answers. */
export async function getExamView(attempt: AttemptRow, test: TestSummary) {
  const [loaded, answers] = await Promise.all([loadQuestions(attempt.questionIds), savedAnswers(attempt.id)]);
  // Questions appear in the attempt's own order (random for practice, paper order for mocks).
  const questions: ExamQuestion[] = loaded.map((q) => {
    const keys = test.shuffle ? seededOrder(attempt.id * 7919 + q.id) : [...LETTERS];
    return {
      id: q.id,
      number: q.number,
      topic: q.topic,
      instruction: q.instruction,
      passage: q.passage,
      prompt: q.prompt,
      options: keys.map((key) => ({ key, text: q.choices[key] })),
    };
  });
  return {
    attemptId: attempt.id,
    testTitle: test.title,
    kind: test.kind,
    expiresAt: attempt.expiresAt,
    serverNow: Date.now(),
    questions,
    answers,
  };
}

export async function getResult(attempt: AttemptRow) {
  const [loaded, answers] = await Promise.all([loadQuestions(attempt.questionIds), savedAnswers(attempt.id)]);
  const review = groupByTopic(loaded.sort((a, b) => a.number - b.number)).map((q) => ({
    id: q.id,
    number: q.number,
    topic: q.topic,
    passage: q.passage,
    prompt: q.prompt || q.instruction,
    choices: q.choices,
    correct: q.answer,
    chosen: answers[q.id] ?? null,
    explanation: q.explanation,
    tip: q.tip,
    source: q.source,
  }));

  const topics = new Map<string, { correct: number; total: number }>();
  for (const r of review) {
    const t = topics.get(r.topic) ?? { correct: 0, total: 0 };
    t.total += 1;
    if (r.chosen === r.correct) t.correct += 1;
    topics.set(r.topic, t);
  }

  const score = attempt.score ?? 0;
  const percentage = percent(score, attempt.total);
  return {
    score,
    total: attempt.total,
    answered: Object.keys(answers).length,
    percentage,
    passed: percentage >= PASS_MARK,
    review,
    topics: [...topics.entries()].map(([topic, t]) => ({ topic, ...t, percentage: percent(t.correct, t.total) })),
  };
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type AttemptSummary = {
  id: number;
  testId: number;
  testTitle: string;
  category: string;
  kind: TestKind;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  submittedAt: number;
};

export async function getSubmittedAttempts(candidateId: number): Promise<AttemptSummary[]> {
  const rows = await all(
    `SELECT a.id, a.test_id, a.score, a.total, a.submitted_at, t.title, t.kind, t.category
     FROM attempts a JOIN tests t ON t.id = a.test_id
     WHERE a.candidate_id = ? AND a.submitted_at IS NOT NULL
     ORDER BY a.submitted_at DESC`,
    [candidateId],
  );
  return rows.map((r) => {
    const score = Number(r.score);
    const total = Number(r.total);
    const percentage = percent(score, total);
    return {
      id: Number(r.id),
      testId: Number(r.test_id),
      testTitle: String(r.title),
      category: String(r.category),
      kind: r.kind as TestKind,
      score,
      total,
      percentage,
      passed: percentage >= PASS_MARK,
      submittedAt: Number(r.submitted_at),
    };
  });
}

/** Every topic in the bank (paper order) with the candidate's accuracy across submitted attempts. */
async function getTopicScores(candidateId: number) {
  const [topicRows, perfRows] = await Promise.all([
    all("SELECT topic FROM questions GROUP BY topic ORDER BY MIN(position)"),
    all(
      `SELECT q.topic, COUNT(*) AS total, SUM(CASE WHEN aa.choice = q.answer THEN 1 ELSE 0 END) AS correct
       FROM attempts a
       CROSS JOIN LATERAL jsonb_array_elements_text(a.question_ids::jsonb) AS j(value)
       JOIN questions q ON q.id = j.value::int
       LEFT JOIN attempt_answers aa ON aa.attempt_id = a.id AND aa.question_id = q.id
       WHERE a.candidate_id = ? AND a.submitted_at IS NOT NULL
       GROUP BY q.topic`,
      [candidateId],
    ),
  ]);
  const perf = new Map(perfRows.map((r) => [String(r.topic), { total: Number(r.total), correct: Number(r.correct) }]));
  return topicRows.map((r) => {
    const topic = String(r.topic);
    const t = perf.get(topic);
    return { topic, attempted: t?.total ?? 0, percentage: t ? percent(t.correct, t.total) : null };
  });
}

export async function getDashboard(candidate: Candidate) {
  await closeExpiredAttempts(candidate.id);
  const [attempts, tests, topicScores, feedbackCount] = await Promise.all([
    getSubmittedAttempts(candidate.id),
    getAvailableTests(candidate),
    getTopicScores(candidate.id),
    countFeedbacks(candidate.id),
  ]);
  const takenOfficial = new Set(attempts.filter((a) => a.kind === "official").map((a) => a.testId));

  const taken = attempts.length;
  const passed = attempts.filter((a) => a.passed).length;
  const avg = taken ? Math.round((attempts.reduce((s, a) => s + a.percentage, 0) / taken) * 10) / 10 : 0;

  return {
    taken,
    passed,
    failed: taken - passed,
    passRate: taken ? Math.round((passed / taken) * 1000) / 10 : 0,
    avgScore: avg,
    best: taken ? Math.max(...attempts.map((a) => a.percentage)) : 0,
    pendingOfficial: tests.filter((t) => t.kind === "official" && !takenOfficial.has(t.id)),
    topicScores,
    recent: attempts.slice(0, 6),
    feedbackCount,
  };
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export async function countFeedbacks(candidateId: number) {
  return Number((await get("SELECT COUNT(*) AS n FROM feedbacks WHERE candidate_id = ?", [candidateId]))!.n);
}

export async function addFeedback(candidateId: number, displayName: string, message: string) {
  if ((await countFeedbacks(candidateId)) >= MAX_FEEDBACKS) {
    throw new AttemptError(`You can send up to ${MAX_FEEDBACKS} feedback messages.`);
  }
  await run("INSERT INTO feedbacks (candidate_id, display_name, message) VALUES (?, ?, ?)", [
    candidateId,
    displayName,
    message,
  ]);
}

export async function getFeedbacks(candidateId: number) {
  const rows = await all(
    "SELECT id, display_name, message, created_at FROM feedbacks WHERE candidate_id = ? ORDER BY id DESC",
    [candidateId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    displayName: String(r.display_name),
    message: String(r.message),
    createdAt: String(r.created_at),
  }));
}
