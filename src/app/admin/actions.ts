"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AdminError,
  createQuestion,
  createTest,
  deleteCandidate,
  deleteFeedback,
  deleteQuestion,
  deleteTest,
  findAdmin,
  getAdminPasswordHash,
  importQuestionsCsv,
  resetAttempts,
  setAdminPassword,
  updateCandidate,
  updateQuestion,
  updateTest,
  type QuestionInput,
  type TestInput,
} from "@/lib/admin-data";
import { GENDERS, type CandidateAccess, type TestKind } from "@/lib/constants";
import type { Letter } from "@/lib/data";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, requireAdmin } from "@/lib/session";

export type AdminFormState = { error?: string; success?: string } | undefined;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const int = (fd: FormData, key: string) => Number.parseInt(String(fd.get(key) ?? ""), 10) || 0;

async function guard<T>(fn: () => Promise<T>): Promise<T | AdminFormState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AdminError) return { error: e.message };
    throw e;
  }
}

/* Auth ------------------------------------------------------------- */

export async function adminLogin(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const username = text(fd, "username");
  const password = String(fd.get("password") ?? "");
  const admin = username && password ? await findAdmin(username) : null;
  if (!admin || !verifyPassword(password, admin.passwordHash)) return { error: "Incorrect username or password." };
  await createSession(admin.id, "admin");
  redirect("/admin");
}

export async function adminLogout() {
  await destroySession("admin");
  redirect("/admin/login");
}

export async function changeAdminPassword(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const hash = await getAdminPasswordHash(admin.id);
  if (!hash || !verifyPassword(current, hash)) return { error: "Your current password is incorrect." };
  if (next.length < 8) return { error: "Use at least 8 characters for the new password." };
  if (next !== confirm) return { error: "The new passwords don't match." };
  await setAdminPassword(admin.id, hashPassword(next));
  return { success: "Password updated." };
}

/* Tests ------------------------------------------------------------ */

function readTest(fd: FormData): TestInput | string {
  const kind = text(fd, "kind") as TestKind;
  const input: TestInput = {
    title: text(fd, "title"),
    category: text(fd, "category"),
    description: text(fd, "description"),
    kind,
    timeLimit: int(fd, "timeLimit"),
    questionLimit: int(fd, "questionLimit"),
    shuffle: fd.get("shuffle") === "on",
  };
  if (!input.title) return "Enter a title.";
  if (kind !== "official" && kind !== "practice") return "Choose a test type.";
  if (kind === "official") {
    if (input.timeLimit < 1 || input.timeLimit > 600) return "Set a time limit between 1 and 600 minutes.";
    if (input.questionLimit < 1) return "Set how many questions the test shows.";
  } else {
    input.timeLimit = 0;
    input.questionLimit = 0;
  }
  return input;
}

export async function saveTest(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const input = readTest(fd);
  if (typeof input === "string") return { error: input };
  const id = int(fd, "id");
  const result = await guard(async () => (id ? (await updateTest(id, input), id) : createTest(input)));
  if (typeof result !== "number") return result;
  revalidatePath("/admin", "layout");
  if (id) return { success: "Test details saved." };
  redirect(`/admin/tests/${result}`);
}

export async function removeTest(fd: FormData) {
  await requireAdmin();
  await deleteTest(int(fd, "id"));
  revalidatePath("/admin", "layout");
  redirect("/admin/tests");
}

/* Questions -------------------------------------------------------- */

function readQuestion(fd: FormData): QuestionInput {
  return {
    topic: text(fd, "topic"),
    instruction: text(fd, "instruction"),
    passage: String(fd.get("passage") ?? "").trim(),
    prompt: text(fd, "prompt"),
    choices: { A: text(fd, "choiceA"), B: text(fd, "choiceB"), C: text(fd, "choiceC"), D: text(fd, "choiceD") },
    answer: text(fd, "answer") as Letter,
    explanation: text(fd, "explanation"),
    tip: text(fd, "tip"),
    source: text(fd, "source"),
  };
}

export async function saveQuestion(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const id = int(fd, "id");
  const testId = int(fd, "testId");
  const q = readQuestion(fd);
  const result = await guard(async () => (id ? updateQuestion(id, q) : createQuestion(testId, q)));
  if (result) return result;
  revalidatePath(`/admin/tests/${testId}`);
  if (id) redirect(`/admin/tests/${testId}#q-${id}`);
  return { success: "Question added." };
}

export async function removeQuestion(fd: FormData) {
  await requireAdmin();
  await deleteQuestion(int(fd, "id"));
  revalidatePath(`/admin/tests/${int(fd, "testId")}`);
}

export async function importCsv(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const testId = int(fd, "testId");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to upload." };
  if (file.size > 2_000_000) return { error: "That file is too large (2 MB max)." };
  const csv = await file.text();
  const result = await guard(() => importQuestionsCsv(testId, csv, text(fd, "topic")));
  if (!result || !("inserted" in result)) return result as AdminFormState;
  revalidatePath(`/admin/tests/${testId}`);
  const parts = [`Imported ${result.inserted} question${result.inserted === 1 ? "" : "s"}.`];
  if (result.duplicates) parts.push(`${result.duplicates} duplicate(s) skipped.`);
  if (result.problems.length) parts.push(`Skipped rows — ${result.problems.join("; ")}`);
  return result.inserted > 0 ? { success: parts.join(" ") } : { error: parts.join(" ") };
}

/* Candidates ------------------------------------------------------- */

export async function saveCandidate(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const id = int(fd, "id");
  const access = text(fd, "access") as CandidateAccess;
  const status = text(fd, "status");
  const input = {
    fullName: text(fd, "fullName"),
    email: text(fd, "email").toLowerCase(),
    course: text(fd, "course"),
    department: text(fd, "department"),
    gender: text(fd, "gender"),
    access,
    status,
  };
  if (!input.fullName) return { error: "Enter the candidate's name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email)) return { error: "Enter a valid email address." };
  if (input.gender && !(GENDERS as readonly string[]).includes(input.gender)) return { error: "Choose a gender from the list." };
  if (!["both", "official", "practice"].includes(access)) return { error: "Choose what the candidate can access." };
  if (!["active", "inactive"].includes(status)) return { error: "Choose a status." };
  const result = await guard(() => updateCandidate(id, input));
  if (result) return result;
  revalidatePath("/admin/candidates", "layout");
  return { success: "Candidate saved." };
}

export async function removeCandidate(fd: FormData) {
  await requireAdmin();
  await deleteCandidate(int(fd, "id"));
  revalidatePath("/admin", "layout");
  redirect("/admin/candidates");
}

export async function resetCandidateTest(fd: FormData) {
  await requireAdmin();
  const candidateId = int(fd, "candidateId");
  await resetAttempts(candidateId, int(fd, "testId"));
  revalidatePath(`/admin/candidates/${candidateId}`);
}

/* Feedback --------------------------------------------------------- */

export async function removeFeedback(fd: FormData) {
  await requireAdmin();
  await deleteFeedback(int(fd, "id"));
  revalidatePath("/admin/feedback");
}
