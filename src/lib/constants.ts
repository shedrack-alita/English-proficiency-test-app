export const APP_NAME = "EPTPREP";
export const APP_TAGLINE = "English Proficiency Test Preparation";

export type TestKind = "official" | "practice";
export type CandidateAccess = "both" | "official" | "practice";

export const KIND_LABEL: Record<TestKind, string> = {
  official: "Mock Examination",
  practice: "Practice",
};

/** Practice builder limits. */
export const PRACTICE_TIME_PRESETS = [10, 15, 20, 30, 45, 60, 90, 120];
export const PRACTICE_MAX_MINUTES = 300;
export const PRACTICE_QUESTION_PRESETS = [10, 20, 50, 100, 150];
export const PRACTICE_MAX_QUESTIONS = 200;
/** Suggested pace for practice sets; the UI paper allows 60 minutes for 150 questions (24s each). */
export const SECONDS_PER_QUESTION = 36;

/** The UI Postgraduate School requires at least 40% on the proficiency test. */
export const PASS_MARK = 40;

/** Gender options on the sign-up form. */
export const GENDERS = ["Female", "Male"] as const;

export const MAX_FEEDBACKS = 3;
/** Seconds after the timer ends during which answers and submission are still accepted. */
export const SUBMIT_GRACE_SECONDS = 30;

export type Tone = "amber" | "green" | "blue" | "red";

/** Proficiency bands from the UI Postgraduate School sample-question booklet. */
export function rating(percentage: number): { label: string; tone: Tone } {
  if (percentage >= 85) return { label: "Highly proficient", tone: "amber" };
  if (percentage >= 70) return { label: "Proficient", tone: "green" };
  if (percentage >= 60) return { label: "Fairly proficient", tone: "blue" };
  if (percentage >= 50) return { label: "Scarcely proficient", tone: "blue" };
  if (percentage >= PASS_MARK) return { label: "Not yet proficient", tone: "red" };
  return { label: "Below the pass mark", tone: "red" };
}

export function percent(score: number, total: number) {
  return total > 0 ? Math.round((score / total) * 1000) / 10 : 0;
}

export function suggestedMinutes(questions: number) {
  return Math.max(5, Math.ceil((questions * SECONDS_PER_QUESTION) / 60));
}
