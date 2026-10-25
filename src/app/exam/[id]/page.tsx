import { notFound, redirect } from "next/navigation";
import { finalizeAttempt, getAttempt, getExamView, getTest, isOpen } from "@/lib/data";
import { requireCandidate } from "@/lib/session";
import { ExamRunner } from "./exam-runner";

export const metadata = { title: "Exam in progress" };

export default async function ExamPage({ params }: PageProps<"/exam/[id]">) {
  const candidate = await requireCandidate();
  const attempt = await getAttempt(Number((await params).id));
  if (!attempt || attempt.candidateId !== candidate.id) notFound();

  if (attempt.submittedAt !== null) redirect(`/dashboard/results/${attempt.id}`);
  if (!isOpen(attempt)) {
    await finalizeAttempt(attempt.id);
    redirect(`/dashboard/results/${attempt.id}`);
  }

  const test = await getTest(attempt.testId);
  if (!test) notFound();

  return <ExamRunner exam={await getExamView(attempt, test)} />;
}
