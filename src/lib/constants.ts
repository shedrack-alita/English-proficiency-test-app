export const APP_NAME = "EPTPREP";
export const APP_TAGLINE = "English Proficiency Test Preparation";

export const LEVELS = {
  A1: "A1 · Beginner",
  A2: "A2 · Elementary",
  B1: "B1 · Intermediate",
  B2: "B2 · Upper Intermediate",
  C1: "C1 · Advanced",
  C2: "C2 · Proficient",
} as const;

export type Level = keyof typeof LEVELS;

export function levelLabel(level: string) {
  return LEVELS[level as Level] ?? level;
}

export type TestKind = "official" | "practice";
export type CandidateAccess = "both" | "official" | "practice";

export const KIND_LABEL: Record<TestKind, string> = {
  official: "Proficiency Test",
  practice: "Practice Test",
};

export const PRACTICE_TIME_OPTIONS = [10, 15, 20, 30, 45, 60];

export const PASS_MARK = 50;
export const MAX_FEEDBACKS = 3;
/** Seconds after the timer ends during which a submission is still accepted. */
export const SUBMIT_GRACE_SECONDS = 30;

export function rating(percentage: number) {
  if (percentage >= 90) return { label: "Excellent", tone: "amber" as const };
  if (percentage >= 80) return { label: "Very good", tone: "green" as const };
  if (percentage >= PASS_MARK) return { label: "Good", tone: "blue" as const };
  return { label: "Needs work", tone: "red" as const };
}

export function percent(score: number, total: number) {
  return total > 0 ? Math.round((score / total) * 1000) / 10 : 0;
}
