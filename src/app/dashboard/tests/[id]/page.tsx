import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Alert, Badge, PageHeader } from "@/components/ui";
import { KIND_LABEL } from "@/lib/constants";
import {
  canAccess,
  closeExpiredAttempts,
  findOpenAttempt,
  getTest,
  getTopicCounts,
  latestSubmittedAttemptId,
  officialQuestionCount,
} from "@/lib/data";
import { requireCandidate } from "@/lib/session";
import { StartForm } from "./start-form";

export async function generateMetadata({ params }: PageProps<"/dashboard/tests/[id]">) {
  const test = await getTest(Number((await params).id));
  return { title: test?.title ?? "Test" };
}

export default async function TestPage({ params }: PageProps<"/dashboard/tests/[id]">) {
  const candidate = await requireCandidate();
  const test = await getTest(Number((await params).id));
  if (!test || !canAccess(candidate, test)) notFound();
  if (test.kind === "practice") redirect("/dashboard/tests#practice");

  await closeExpiredAttempts(candidate.id);
  const lastResultId = await latestSubmittedAttemptId(candidate.id, test.id);
  const open = await findOpenAttempt(candidate.id, test.id);
  const isOfficial = test.kind === "official";
  const topicCounts = isOfficial ? [] : await getTopicCounts(test.id);
  const questionCount = isOfficial ? officialQuestionCount(test) : test.questionCount;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/tests" className="btn-ghost -ml-3 mb-4 px-3">
        <ArrowLeft className="size-4" aria-hidden /> All tests
      </Link>
      <PageHeader title={test.title} subtitle={<Badge tone="brand">{KIND_LABEL[test.kind]}</Badge>} />

      <div className="card p-6 sm:p-8">
        <p className="text-muted">{test.description}</p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <Fact label="Questions" value={isOfficial ? questionCount : `Up to ${questionCount}`} />
          <Fact label="Time" value={isOfficial ? `${test.timeLimit} minutes` : "You choose"} />
          <Fact
            label="Attempts"
            value={isOfficial ? "One only" : "Unlimited"}
          />
        </dl>

        {isOfficial && test.topics.length > 1 && (
          <div className="mt-6">
            <div className="text-sm font-medium">Topics covered</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {test.topics.map((t) => (
                <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-line pt-6">
          {isOfficial && lastResultId ? (
            <div className="space-y-4">
              <Alert tone="success">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="size-4" aria-hidden /> You have completed this mock examination.
                </span>
              </Alert>
              <Link href={`/dashboard/results/${lastResultId}`} className="btn-primary">
                View your result
              </Link>
            </div>
          ) : isOfficial ? (
            <>
              {open ? (
                <Alert tone="warning">You have an attempt in progress. Resume it before the timer runs out.</Alert>
              ) : (
                <ul className="mb-6 space-y-2 text-sm text-muted">
                  <li>• The timer starts as soon as you begin and keeps running if you leave the page.</li>
                  <li>• Your answers save automatically. You can move between questions freely.</li>
                  <li>• When time runs out, your answers are submitted automatically.</li>
                </ul>
              )}
              <div className="mt-4">
                <StartForm testId={test.id} kind="official" resume={!!open} />
              </div>
            </>
          ) : (
            <>
              {lastResultId && (
                <p className="mb-5 text-sm text-muted">
                  You&apos;ve practised this before.{" "}
                  <Link href={`/dashboard/results/${lastResultId}`} className="font-medium text-brand hover:underline">
                    See your last result
                  </Link>
                </p>
              )}
              <StartForm testId={test.id} kind="practice" maxQuestions={test.questionCount} topics={topicCounts} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
