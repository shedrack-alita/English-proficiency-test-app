"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AttemptError,
  addFeedback,
  canAccess,
  createCandidate,
  findCandidateForLogin,
  finalizeAttempt,
  getAttempt,
  getTest,
  getTopicCounts,
  saveAnswer,
  startAttempt,
  type Letter,
} from "@/lib/data";
import { GENDERS, PRACTICE_MAX_MINUTES, PRACTICE_MAX_QUESTIONS } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, requireCandidate } from "@/lib/session";

export type FormState = { error?: string; success?: string; email?: string } | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function loginCandidate(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", email };

  const candidate = await findCandidateForLogin(email);
  if (!candidate) return { error: "No account uses that email yet. Create one to get started.", email };
  if (!verifyPassword(password, candidate.passwordHash)) return { error: "That password isn't right.", email };
  if (candidate.status !== "active") {
    return { error: "Your account is inactive. Please contact your administrator.", email };
  }

  await createSession(candidate.id, "candidate");
  redirect("/dashboard");
}

export type SignupState =
  | { error?: string; fullName?: string; email?: string; course?: string; department?: string; gender?: string }
  | undefined;

export async function signupCandidate(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const fullName = String(formData.get("fullName") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const course = String(formData.get("course") ?? "").trim().replace(/\s+/g, " ");
  const department = String(formData.get("department") ?? "").trim().replace(/\s+/g, " ");
  const gender = String(formData.get("gender") ?? "");
  const password = String(formData.get("password") ?? "");
  const keep = { fullName, email, course, department, gender };
  if (fullName.length < 2) return { error: "Enter your full name.", ...keep };
  if (fullName.length > 100) return { error: "Please shorten your name to 100 characters.", ...keep };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", ...keep };
  if (course.length < 2) return { error: "Enter the course of study you applied for.", ...keep };
  if (course.length > 120) return { error: "Please shorten the course name to 120 characters.", ...keep };
  if (department.length < 2) return { error: "Enter the department you applied to.", ...keep };
  if (department.length > 120) return { error: "Please shorten the department name to 120 characters.", ...keep };
  if (!(GENDERS as readonly string[]).includes(gender)) return { error: "Select your gender.", ...keep };
  if (password.length < 6) return { error: "Use at least 6 characters for your password.", ...keep };

  const candidate = await createCandidate({ fullName, email, course, department, gender }, hashPassword(password));
  if (!candidate) return { error: "An account already uses that email. Sign in instead.", ...keep };

  await createSession(candidate.id, "candidate");
  redirect("/dashboard?welcome=1");
}

export async function logout() {
  await destroySession("candidate");
  redirect("/");
}

export async function beginTest(_prev: FormState, formData: FormData): Promise<FormState> {
  const candidate = await requireCandidate();
  const test = await getTest(Number(formData.get("testId")));
  if (!test || !canAccess(candidate, test)) return { error: "This test is not available to you." };

  let practice: { minutes: number; questions: number; topics?: string[] } | undefined;
  if (test.kind === "practice") {
    const minutes = Number(formData.get("minutes"));
    const questions = Number(formData.get("questions"));
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > PRACTICE_MAX_MINUTES) {
      return { error: `Choose a time limit between 1 and ${PRACTICE_MAX_MINUTES} minutes.` };
    }

    // Tests covering several topics let the candidate pick which ones to practise.
    const counts = await getTopicCounts(test.id);
    let pool = test.questionCount;
    let topics: string[] | undefined;
    if (counts.length > 1) {
      const chosen = new Set(formData.getAll("topics").map(String));
      const picked = counts.filter((c) => chosen.has(c.topic));
      if (picked.length === 0) return { error: "Choose at least one topic." };
      topics = picked.map((c) => c.topic);
      pool = picked.reduce((sum, c) => sum + c.count, 0);
    }
    const max = Math.min(pool, PRACTICE_MAX_QUESTIONS);
    if (!Number.isInteger(questions) || questions < 1 || questions > max) {
      return { error: `Choose between 1 and ${max} questions.` };
    }
    practice = { minutes, questions, topics };
  }

  let attemptId: number;
  try {
    attemptId = await startAttempt(candidate, test, practice);
  } catch (e) {
    if (e instanceof AttemptError) return { error: e.message };
    throw e;
  }
  redirect(`/exam/${attemptId}`);
}

export async function recordAnswer(attemptId: number, questionId: number, choice: Letter) {
  const candidate = await requireCandidate();
  if (!["A", "B", "C", "D"].includes(choice)) return { ok: false, error: "Invalid choice." };
  try {
    await saveAnswer(candidate.id, attemptId, questionId, choice);
    return { ok: true };
  } catch (e) {
    if (e instanceof AttemptError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function submitAttempt(attemptId: number) {
  const candidate = await requireCandidate();
  const attempt = await getAttempt(attemptId);
  if (!attempt || attempt.candidateId !== candidate.id) redirect("/dashboard");
  await finalizeAttempt(attemptId);
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/results/${attemptId}?submitted=1`);
}

export async function sendFeedback(_prev: FormState, formData: FormData): Promise<FormState> {
  const candidate = await requireCandidate();
  const message = String(formData.get("message") ?? "").trim();
  const anonymous = formData.get("anonymous") === "on";
  if (message.length < 3) return { error: "Please write a little more before sending." };
  if (message.length > 1000) return { error: "Please keep feedback under 1000 characters." };
  try {
    await addFeedback(candidate.id, anonymous ? "Anonymous" : candidate.fullName, message);
  } catch (e) {
    if (e instanceof AttemptError) return { error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/feedback");
  return { success: "Thanks! Your feedback has been sent." };
}
