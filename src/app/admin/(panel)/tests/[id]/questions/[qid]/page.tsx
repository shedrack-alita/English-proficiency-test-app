import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getQuestion, getTopics } from "@/lib/admin-data";
import { QuestionForm } from "../../../../forms";

export const metadata = { title: "Edit question" };

export default async function EditQuestionPage({ params }: PageProps<"/admin/tests/[id]/questions/[qid]">) {
  const { id, qid } = await params;
  const [question, topics] = await Promise.all([getQuestion(Number(qid)), getTopics()]);
  if (!question || question.testId !== Number(id)) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/admin/tests/${id}#q-${question.id}`} className="btn-ghost -ml-3 mb-4 px-3">
        <ArrowLeft className="size-4" aria-hidden /> Back to test
      </Link>
      <PageHeader title={`Edit question ${question.position}`} subtitle={question.topic || undefined} />
      <div className="card p-6 sm:p-8">
        <QuestionForm testId={question.testId} question={question} topics={topics} />
      </div>
    </div>
  );
}
