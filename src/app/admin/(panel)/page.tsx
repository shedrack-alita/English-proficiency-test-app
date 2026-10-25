import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { PASS_MARK } from "@/lib/constants";
import { getOverview, getSignupStats } from "@/lib/admin-data";
import { ResultsTable } from "./results-table";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const [o, signups] = await Promise.all([getOverview(), getSignupStats()]);
  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="How candidates are doing across EPTPREP."
        actions={
          <Link href="/admin/tests/new" className="btn-primary">
            New test
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Registered candidates"
          value={signups.total}
          hint={`${signups.today} today · ${signups.week} in the last 7 days`}
        />
        <StatCard
          label="Submitted attempts"
          value={o.attempts}
          hint={`${o.inProgress} in progress right now`}
        />
        <StatCard label="Average score" value={`${o.avgScore}%`} hint="Across all attempts" />
        <StatCard label="Pass rate" value={`${o.passRate}%`} hint={`Scoring ${PASS_MARK}% or more`} />
      </div>

      <SignupChart signups={signups} />

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-2">
          <h2 className="font-semibold">Accuracy by topic</h2>
          <p className="mt-1 text-xs text-muted">Share of answers that were correct, all candidates.</p>
          {o.topics.length ? (
            <ul className="mt-5 space-y-3.5">
              {o.topics.map((t) => (
                <li key={t.topic} className="text-sm">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="truncate">{t.topic}</span>
                    <span className="tabular-nums text-muted">{t.percentage}%</span>
                  </div>
                  <ProgressBar value={t.percentage} tone={t.percentage >= PASS_MARK ? "ok" : "bad"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Topic accuracy appears once candidates submit attempts.</p>
          )}
        </section>

        <section className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Latest submissions</h2>
            <Link href="/admin/results" className="text-sm font-medium text-brand hover:underline">
              All results
            </Link>
          </div>
          <ResultsTable rows={o.recent} />
        </section>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink href="/admin/tests" title={`${o.tests} tests`} body={`${o.bank} questions in all`} />
        <QuickLink href="/admin/candidates" title="Candidates" body="Edit access, reset attempts" />
        <QuickLink href="/admin/feedback" title={`${o.feedbacks} feedback`} body="Read what candidates say" />
      </div>
    </>
  );
}

function SignupChart({ signups }: { signups: Awaited<ReturnType<typeof getSignupStats>> }) {
  const max = Math.max(1, ...signups.series.map((d) => d.count));
  const day = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
  return (
    <section className="card mt-6 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="font-semibold">Sign-ups, last 14 days</h2>
        <p className="text-sm text-muted">
          {signups.month} in the last 30 days · {signups.tested} of {signups.total} have submitted a test
        </p>
      </div>
      <div className="mt-5 flex h-32 items-end gap-1.5" role="img" aria-label="Daily sign-ups for the last 14 days">
        {signups.series.map((d) => (
          <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${day(d.day)}: ${d.count}`}>
            <span className="mb-1 text-center text-[11px] tabular-nums text-muted">{d.count || ""}</span>
            <div
              className={d.count ? "rounded-t bg-brand" : "rounded-t bg-line"}
              style={{ height: d.count ? `${(d.count / max) * 100}%` : "2px" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted">
        <span>{day(signups.series[0].day)}</span>
        <span>Today (UTC)</span>
      </div>
    </section>
  );
}

function QuickLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="card p-5 transition hover:border-brand/40 hover:shadow-md">
      <div className="font-semibold">{title}</div>
      <div className="mt-0.5 text-sm text-muted">{body}</div>
    </Link>
  );
}
