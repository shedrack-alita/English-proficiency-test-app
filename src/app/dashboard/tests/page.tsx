import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Clock3 } from "lucide-react";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import {
  closeExpiredAttempts,
  getAvailableTests,
  getBankTest,
  getSubmittedAttempts,
  getTopicCounts,
  officialQuestionCount,
  type TestSummary,
} from "@/lib/data";
import { requireCandidate } from "@/lib/session";
import { StartForm } from "./[id]/start-form";

export const metadata: Metadata = { title: "Tests & practice" };

export default async function TestsPage({ searchParams }: PageProps<"/dashboard/tests">) {
  const candidate = await requireCandidate();
  await closeExpiredAttempts(candidate.id);
  const [tests, attempts, bank] = await Promise.all([
    getAvailableTests(candidate),
    getSubmittedAttempts(candidate.id),
    getBankTest(),
  ]);
  const practiceBank = bank && tests.some((t) => t.id === bank.id) ? bank : null;
  const topicCounts = practiceBank ? await getTopicCounts(practiceBank.id) : [];

  // ?topic=Concord (or several) preselects topics, e.g. from the dashboard's "focus next" links.
  const requested = (await searchParams).topic;
  const initialTopics = (Array.isArray(requested) ? requested : requested ? [requested] : []).filter((t) =>
    topicCounts.some((c) => c.topic === t),
  );

  const bestByTest = new Map<number, number>();
  for (const a of attempts) bestByTest.set(a.testId, Math.max(bestByTest.get(a.testId) ?? 0, a.percentage));
  const official = tests.filter((t) => t.kind === "official");

  return (
    <>
      <PageHeader title="Tests & practice" subtitle="Sit a full mock examination, or build a practice set your way." />

      {tests.length === 0 && <EmptyState title="No tests are available to you yet." />}

      {practiceBank && (
        <section id="practice" className="card mb-10 scroll-mt-24 p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3">
            <div>
              <h2 className="text-lg font-semibold">Build a practice set</h2>
              <p className="text-sm text-muted">
                Choose the topics, how many questions and how long you want. Questions are drawn at random from{" "}
                {practiceBank.questionCount.toLocaleString()} in the bank, so every set is different.
              </p>
            </div>
          </div>
          <StartForm
            key={initialTopics.join("|")}
            testId={practiceBank.id}
            kind="practice"
            maxQuestions={practiceBank.questionCount}
            topics={topicCounts}
            initialTopics={initialTopics}
          />
        </section>
      )}

      {official.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Mock examinations</h2>
          <div className="grid gap-4">
            {official.map((t) => (
              <OfficialCard key={t.id} test={t} best={bestByTest.get(t.id)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function OfficialCard({ test, best }: { test: TestSummary; best?: number }) {
  const done = best !== undefined;
  return (
    <div className="card flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{test.title}</h3>
          {done ? (
            <Badge tone="green">
              <CheckCircle2 className="size-3.5" aria-hidden /> Completed · {best}%
            </Badge>
          ) : (
            <Badge tone="brand">Not taken</Badge>
          )}
        </div>
        <p className="mt-1.5 text-sm text-muted">{test.description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>{officialQuestionCount(test)} questions</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" aria-hidden /> {test.timeLimit} minutes
          </span>
          <span>One attempt</span>
        </div>
      </div>
      <Link href={`/dashboard/tests/${test.id}`} className={done ? "btn-secondary" : "btn-primary"}>
        {done ? "View result" : "Start mock exam"}
      </Link>
    </div>
  );
}
