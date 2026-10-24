import "server-only";
import { db, transaction } from "./db";
import {
  MAX_FEEDBACKS,
  PASS_MARK,
  SUBMIT_GRACE_SECONDS,
  percent,
  type CandidateAccess,
  type TestKind,
} from "./constants";

type Row = Record<string, unknown>;
const LETTERS = ["A", "B", "C", "D"] as const;
export type Letter = (typeof LETTERS)[number];

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

export type Candidate = {
  id: number;
  fullName: string;
  email: string;
  level: string;
  access: CandidateAccess;
  status: string;
};

function toCandidate(r: Row): Candidate {
  return {
    id: Number(r.id),
    fullName: String(r.full_name),
    email: String(r.email),
    level: String(r.level),
    access: r.access as CandidateAccess,
    status: String(r.status),
  };
}

export function getCandidate(id: number) {
  const r = db.prepare("SELECT * FROM candidates WHERE id = ?").get(id) as Row | undefined;
  return r ? toCandidate(r) : null;
}

export function findCandidateForLogin(email: string) {
  const r = db.prepare("SELECT * FROM candidates WHERE email = ?").get(email) as Row | undefined;
  return r ? { ...toCandidate(r), passwordHash: String(r.password_hash) } : null;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

export type TestSummary = {
  id: number;
  title: string;
  description: string;
  level: string;
  kind: TestKind;
  timeLimit: number;
  questionLimit: number;
  sectionId: number;
  sectionName: string;
  questionCount: number;
  passage: string;
};

const TEST_SELECT = `
  SELECT t.*, s.name AS section_name,
         (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS question_count
  FROM tests t JOIN sections s ON s.id = t.section_id`;

function toTest(r: Row): TestSummary {
  return {
    id: Number(r.id),
    title: String(r.title),
    description: String(r.description),
    level: String(r.level),
    kind: r.kind as TestKind,
    timeLimit: Number(r.time_limit),
    questionLimit: Number(r.question_limit),
    sectionId: Number(r.section_id),
    sectionName: String(r.section_name),
    questionCount: Number(r.question_count),
    passage: String(r.passage),
  };
}

function kindsFor(access: CandidateAccess): TestKind[] {
  return access === "both" ? ["official", "practice"] : [access];
}

export function canAccess(candidate: Candidate, test: TestSummary) {
  return (
    test.level === candidate.level && kindsFor(candidate.access).includes(test.kind) && test.questionCount > 0
  );
}

/** Number of questions an official test actually shows. */
export function officialQuestionCount(test: TestSummary) {
  return Math.min(test.questionLimit, test.questionCount);
}

export function getTest(id: number) {
  const r = db.prepare(`${TEST_SELECT} WHERE t.id = ?`).get(id) as Row | undefined;
  return r ? toTest(r) : null;
}

export function getAvailableTests(candidate: Candidate) {
  const rows = db
    .prepare(`${TEST_SELECT} WHERE t.level = ? ORDER BY s.name, t.kind, t.title`)
    .all(candidate.level) as Row[];
  return rows.map(toTest).filter((t) => canAccess(candidate, t));
}

/* ------------------------------------------------------------------ */
/* Attempts                                                            */
/* ------------------------------------------------------------------ */

type AttemptRow = {
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

export function getAttempt(id: number) {
  const r = db.prepare("SELECT * FROM attempts WHERE id = ?").get(id) as Row | undefined;
  return r ? toAttempt(r) : null;
}

function isOpen(a: AttemptRow, now = Date.now()) {
  return a.submittedAt === null && now <= a.expiresAt + graceMs;
}

export function hasSubmittedAttempt(candidateId: number, testId: number) {
  return !!db
    .prepare("SELECT 1 FROM attempts WHERE candidate_id = ? AND test_id = ? AND submitted_at IS NOT NULL LIMIT 1")
    .get(candidateId, testId);
}

export function latestSubmittedAttemptId(candidateId: number, testId: number) {
  const r = db
    .prepare(
      "SELECT id FROM attempts WHERE candidate_id = ? AND test_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 1",
    )
    .get(candidateId, testId) as Row | undefined;
  return r ? Number(r.id) : null;
}

export function findOpenAttempt(candidateId: number, testId: number) {
  const rows = db
    .prepare("SELECT * FROM attempts WHERE candidate_id = ? AND test_id = ? AND submitted_at IS NULL ORDER BY id DESC")
    .all(candidateId, testId) as Row[];
  return rows.map(toAttempt).find((a) => isOpen(a)) ?? null;
}

/** Scores an attempt and marks it submitted. Safe to call more than once. */
export function finalizeAttempt(attemptId: number) {
  const attempt = getAttempt(attemptId);
  if (!attempt || attempt.submittedAt !== null) return;
  const placeholders = attempt.questionIds.map(() => "?").join(",") || "NULL";
  const { score } = db
    .prepare(
      `SELECT COUNT(*) AS score FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id AND q.answer = aa.choice
       WHERE aa.attempt_id = ? AND aa.question_id IN (${placeholders})`,
    )
    .get(attemptId, ...attempt.questionIds) as { score: number };
  db.prepare("UPDATE attempts SET submitted_at = ?, score = ? WHERE id = ? AND submitted_at IS NULL").run(
    Math.min(Date.now(), attempt.expiresAt),
    score,
    attemptId,
  );
}

/**
 * Closes attempts whose timer ran out without a submission. Official attempts are scored with
 * whatever was answered; abandoned practice attempts with no answers are discarded.
 */
export function closeExpiredAttempts(candidateId: number) {
  const cutoff = Date.now() - graceMs;
  const rows = db
    .prepare(
      `SELECT a.id, t.kind, (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = a.id) AS answered
       FROM attempts a JOIN tests t ON t.id = a.test_id
       WHERE a.candidate_id = ? AND a.submitted_at IS NULL AND a.expires_at < ?`,
    )
    .all(candidateId, cutoff) as Row[];
  for (const r of rows) {
    if (r.kind === "practice" && Number(r.answered) === 0) {
      db.prepare("DELETE FROM attempts WHERE id = ?").run(r.id as number);
    } else {
      finalizeAttempt(Number(r.id));
    }
  }
}

export class AttemptError extends Error {}

export function startAttempt(
  candidate: Candidate,
  test: TestSummary,
  practice?: { minutes: number; questions: number },
) {
  return transaction(() => {
    let minutes: number;
    let count: number;
    if (test.kind === "official") {
      if (hasSubmittedAttempt(candidate.id, test.id)) throw new AttemptError("You have already taken this test.");
      const open = findOpenAttempt(candidate.id, test.id);
      if (open) return open.id; // resume instead of re-rolling questions
      minutes = test.timeLimit;
      count = officialQuestionCount(test);
    } else {
      if (!practice) throw new AttemptError("Choose a time limit and number of questions.");
      minutes = practice.minutes;
      count = Math.min(practice.questions, test.questionCount);
    }
    if (minutes <= 0 || count <= 0) throw new AttemptError("This test is not fully configured yet.");

    const ids = (
      db.prepare("SELECT id FROM questions WHERE test_id = ? ORDER BY RANDOM() LIMIT ?").all(test.id, count) as Row[]
    ).map((r) => Number(r.id));
    const now = Date.now();
    const res = db
      .prepare(
        "INSERT INTO attempts (candidate_id, test_id, question_ids, started_at, expires_at, total) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(candidate.id, test.id, JSON.stringify(ids), now, now + minutes * 60_000, ids.length);
    return Number(res.lastInsertRowid);
  });
}

export function saveAnswer(candidateId: number, attemptId: number, questionId: number, choice: Letter) {
  const attempt = getAttempt(attemptId);
  if (!attempt || attempt.candidateId !== candidateId) throw new AttemptError("Attempt not found.");
  if (!isOpen(attempt)) throw new AttemptError("This attempt is closed.");
  if (!attempt.questionIds.includes(questionId)) throw new AttemptError("Question is not part of this attempt.");
  db.prepare(
    `INSERT INTO attempt_answers (attempt_id, question_id, choice) VALUES (?, ?, ?)
     ON CONFLICT (attempt_id, question_id) DO UPDATE SET choice = excluded.choice`,
  ).run(attemptId, questionId, choice);
}

/* Deterministic shuffle so choices keep their order across page reloads. */
function seededOrder(seed: number) {
  const order = [...LETTERS];
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

type QuestionRow = { id: number; prompt: string; choices: Record<Letter, string>; answer: Letter };

function loadQuestions(ids: number[]) {
  if (ids.length === 0) return [];
  const rows = db
    .prepare(`SELECT * FROM questions WHERE id IN (${ids.map(() => "?").join(",")})`)
    .all(...ids) as Row[];
  const byId = new Map<number, QuestionRow>(
    rows.map((r) => [
      Number(r.id),
      {
        id: Number(r.id),
        prompt: String(r.prompt),
        choices: { A: String(r.choice_a), B: String(r.choice_b), C: String(r.choice_c), D: String(r.choice_d) },
        answer: r.answer as Letter,
      },
    ]),
  );
  // Keep the attempt's order; skip questions deleted since the attempt started.
  return ids.map((id) => byId.get(id)).filter((q): q is QuestionRow => !!q);
}

function savedAnswers(attemptId: number) {
  const rows = db.prepare("SELECT question_id, choice FROM attempt_answers WHERE attempt_id = ?").all(attemptId) as Row[];
  return Object.fromEntries(rows.map((r) => [Number(r.question_id), r.choice as Letter])) as Record<number, Letter>;
}

export type ExamQuestion = { id: number; prompt: string; options: { key: Letter; text: string }[] };

/** Everything the exam screen needs — never includes correct answers. */
export function getExamView(attempt: AttemptRow, test: TestSummary) {
  const questions: ExamQuestion[] = loadQuestions(attempt.questionIds).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: seededOrder(attempt.id * 7919 + q.id).map((key) => ({ key, text: q.choices[key] })),
  }));
  return {
    attemptId: attempt.id,
    testTitle: test.title,
    sectionName: test.sectionName,
    kind: test.kind,
    passage: test.passage,
    expiresAt: attempt.expiresAt,
    questions,
    answers: savedAnswers(attempt.id),
  };
}

export function getResult(attempt: AttemptRow) {
  const answers = savedAnswers(attempt.id);
  const review = loadQuestions(attempt.questionIds).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    choices: q.choices,
    correct: q.answer,
    chosen: answers[q.id] ?? null,
  }));
  const score = attempt.score ?? 0;
  const percentage = percent(score, attempt.total);
  return { score, total: attempt.total, percentage, passed: percentage >= PASS_MARK, review };
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type AttemptSummary = {
  id: number;
  testId: number;
  testTitle: string;
  sectionName: string;
  kind: TestKind;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  submittedAt: number;
};

export function getSubmittedAttempts(candidateId: number): AttemptSummary[] {
  const rows = db
    .prepare(
      `SELECT a.id, a.test_id, a.score, a.total, a.submitted_at, t.title, t.kind, s.name AS section_name
       FROM attempts a JOIN tests t ON t.id = a.test_id JOIN sections s ON s.id = t.section_id
       WHERE a.candidate_id = ? AND a.submitted_at IS NOT NULL
       ORDER BY a.submitted_at DESC`,
    )
    .all(candidateId) as Row[];
  return rows.map((r) => {
    const score = Number(r.score);
    const total = Number(r.total);
    const percentage = percent(score, total);
    return {
      id: Number(r.id),
      testId: Number(r.test_id),
      testTitle: String(r.title),
      sectionName: String(r.section_name),
      kind: r.kind as TestKind,
      score,
      total,
      percentage,
      passed: percentage >= PASS_MARK,
      submittedAt: Number(r.submitted_at),
    };
  });
}

export function getDashboard(candidate: Candidate) {
  closeExpiredAttempts(candidate.id);
  const attempts = getSubmittedAttempts(candidate.id);
  const tests = getAvailableTests(candidate);
  const takenOfficial = new Set(attempts.filter((a) => a.kind === "official").map((a) => a.testId));

  const taken = attempts.length;
  const passed = attempts.filter((a) => a.passed).length;
  const avg = taken ? Math.round((attempts.reduce((s, a) => s + a.percentage, 0) / taken) * 10) / 10 : 0;

  const bySection = new Map<string, { sum: number; n: number }>();
  for (const a of attempts) {
    const e = bySection.get(a.sectionName) ?? { sum: 0, n: 0 };
    e.sum += a.percentage;
    e.n += 1;
    bySection.set(a.sectionName, e);
  }

  return {
    taken,
    passed,
    failed: taken - passed,
    passRate: taken ? Math.round((passed / taken) * 1000) / 10 : 0,
    avgScore: avg,
    best: taken ? Math.max(...attempts.map((a) => a.percentage)) : 0,
    pendingOfficial: tests.filter((t) => t.kind === "official" && !takenOfficial.has(t.id)),
    practiceCount: tests.filter((t) => t.kind === "practice").length,
    sectionScores: [...bySection.entries()]
      .map(([name, { sum, n }]) => ({ name, avg: Math.round((sum / n) * 10) / 10, attempts: n }))
      .sort((a, b) => b.avg - a.avg),
    recent: attempts.slice(0, 6),
    feedbackCount: countFeedbacks(candidate.id),
  };
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function countFeedbacks(candidateId: number) {
  return Number(
    (db.prepare("SELECT COUNT(*) AS n FROM feedbacks WHERE candidate_id = ?").get(candidateId) as Row).n,
  );
}

export function addFeedback(candidateId: number, displayName: string, message: string) {
  if (countFeedbacks(candidateId) >= MAX_FEEDBACKS) {
    throw new AttemptError(`You can send up to ${MAX_FEEDBACKS} feedback messages.`);
  }
  db.prepare("INSERT INTO feedbacks (candidate_id, display_name, message) VALUES (?, ?, ?)").run(
    candidateId,
    displayName,
    message,
  );
}

export function getFeedbacks(candidateId: number) {
  return (
    db
      .prepare("SELECT id, display_name, message, created_at FROM feedbacks WHERE candidate_id = ? ORDER BY id DESC")
      .all(candidateId) as Row[]
  ).map((r) => ({
    id: Number(r.id),
    displayName: String(r.display_name),
    message: String(r.message),
    createdAt: String(r.created_at),
  }));
}
