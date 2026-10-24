"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AttemptError,
  addFeedback,
  canAccess,
  findCandidateForLogin,
  finalizeAttempt,
  getAttempt,
  getTest,
  saveAnswer,
  startAttempt,
  type Letter,
} from "@/lib/data";
import { PRACTICE_TIME_OPTIONS } from "@/lib/constants";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession, requireCandidate } from "@/lib/session";

export type FormState = { error?: string; success?: string } | undefined;

export async function loginCandidate(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const candidate = findCandidateForLogin(email);
  if (!candidate || !verifyPassword(password, candidate.passwordHash)) {
    return { error: "That email and password don't match our records." };
  }
  if (candidate.status !== "active") return { error: "Your account is inactive. Please contact your administrator." };

  await createSession(candidate.id, "candidate");
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function beginTest(_prev: FormState, formData: FormData): Promise<FormState> {
  const candidate = await requireCandidate();
  const test = getTest(Number(formData.get("testId")));
  if (!test || !canAccess(candidate, test)) return { error: "This test is not available to you." };

  let practice: { minutes: number; questions: number } | undefined;
  if (test.kind === "practice") {
    const minutes = Number(formData.get("minutes"));
    const questions = Number(formData.get("questions"));
    if (!PRACTICE_TIME_OPTIONS.includes(minutes)) return { error: "Choose a valid time limit." };
    if (!Number.isInteger(questions) || questions < 1 || questions > test.questionCount) {
      return { error: `Choose between 1 and ${test.questionCount} questions.` };
    }
    practice = { minutes, questions };
  }

  let attemptId: number;
  try {
    attemptId = startAttempt(candidate, test, practice);
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
    saveAnswer(candidate.id, attemptId, questionId, choice);
    return { ok: true };
  } catch (e) {
    if (e instanceof AttemptError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function submitAttempt(attemptId: number) {
  const candidate = await requireCandidate();
  const attempt = getAttempt(attemptId);
  if (!attempt || attempt.candidateId !== candidate.id) redirect("/dashboard");
  finalizeAttempt(attemptId);
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
    addFeedback(candidate.id, anonymous ? "Anonymous" : candidate.fullName, message);
  } catch (e) {
    if (e instanceof AttemptError) return { error: e.message };
    throw e;
  }
  revalidatePath("/dashboard/feedback");
  return { success: "Thanks! Your feedback has been sent." };
}
