import Link from "next/link";
import type { Metadata } from "next";
import { Clock3 } from "lucide-react";
import { Badge, EmptyState, PageHeader, ProgressBar, StatCard, formatDate } from "@/components/ui";
import { KIND_LABEL, PASS_MARK, rating } from "@/lib/constants";
import { getDashboard } from "@/lib/data";
import { requireCandidate } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const candidate = await requireCandidate();
  const d = await getDashboard(candidate);
  const firstName = candidate.fullName.split(" ")[0];
  const weakest = d.topicScores
    .filter((t) => t.percentage !== null)
    .sort((a, b) => a.percentage! - b.percentage!)
    .slice(0, 3);

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle="Here's how your English Proficiency Test preparation is going."
        actions={
          <Link href="/dashboard/tests" className="btn-primary">
            Start practising           </Link>
        }
      />

      {d.pendingOfficial.map((t) => (
        <div key={t.id} className="card mb-6 flex flex-wrap items-center justify-between gap-4 border-brand/30 bg-brand-soft p-5">
          <div className="flex items-start gap-4">
            <div>
              <div className="font-semibold text-ink">{t.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                <span>{t.questionCount} questions</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" aria-hidden /> {t.timeLimit} minutes
                </span>
                <span>One attempt</span>
              </div>
            </div>
          </div>
          <Link href={`/dashboard/tests/${t.id}`} className="btn-primary">
            Take the mock exam
          </Link>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Attempts" value={d.taken} hint="Mock exams and practice sets" />
        <StatCard label="Average score" value={`${d.avgScore}%`} hint="Across all attempts" />
        <StatCard label="Best score" value={`${d.best}%`} hint="Your personal best" />
        <StatCard
          label="Pass rate"
          value={`${d.passRate}%`}
          hint={`${d.passed} passed · ${d.failed} below ${PASS_MARK}%`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Performance by topic</h2>
            <Link href="/dashboard/tests#practice" className="text-sm font-medium text-brand hover:underline">
              Build a practice set
            </Link>
          </div>
          <ul className="mt-5 space-y-3.5">
            {d.topicScores.map((t) => (
              <li key={t.topic} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-sm">
                <span className="truncate">{t.topic}</span>
                {t.percentage === null ? (
                  <span className="text-xs text-muted">Not attempted yet</span>
                ) : (
                  <ProgressBar value={t.percentage} tone={t.percentage >= PASS_MARK ? "ok" : "bad"} />
                )}
                <span className="text-right tabular-nums text-muted">{t.percentage === null ? "—" : `${t.percentage}%`}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              Focus next on
            </h2>
            {weakest.length ? (
              <ul className="mt-4 space-y-2">
                {weakest.map((t) => (
                  <li key={t.topic}>
                    <Link
                      href={`/dashboard/tests?topic=${encodeURIComponent(t.topic)}#practice`}
                      className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm transition hover:bg-brand-soft"
                    >
                      <span>{t.topic}</span>
                      <Badge tone={rating(t.percentage!).tone}>{t.percentage}%</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Complete a practice set and we&apos;ll suggest the topics that need the most work.</p>
            )}
          </section>

          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Recent activity</h2>
              <Link href="/dashboard/results" className="text-sm font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            {d.recent.length ? (
              <ul className="mt-4 divide-y divide-line">
                {d.recent.map((a) => (
                  <li key={a.id}>
                    <Link href={`/dashboard/results/${a.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{a.testTitle}</div>
                        <div className="text-xs text-muted">
                          {KIND_LABEL[a.kind]} · {formatDate(a.submittedAt)}
                        </div>
                      </div>
                      <Badge tone={rating(a.percentage).tone}>{a.percentage}%</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState title="No attempts yet">Your results will appear here.</EmptyState>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
