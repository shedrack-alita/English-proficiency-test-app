import Link from "next/link";
import type { Metadata } from "next";
import { Badge, EmptyState, PageHeader, formatDate } from "@/components/ui";
import { KIND_LABEL, rating } from "@/lib/constants";
import { closeExpiredAttempts, getSubmittedAttempts } from "@/lib/data";
import { requireCandidate } from "@/lib/session";

export const metadata: Metadata = { title: "My results" };

export default async function ResultsPage() {
  const candidate = await requireCandidate();
  await closeExpiredAttempts(candidate.id);
  const attempts = await getSubmittedAttempts(candidate.id);

  return (
    <>
      <PageHeader title="My results" subtitle="Every mock exam and practice set you've completed." />
      {attempts.length === 0 ? (
        <EmptyState title="No results yet">
          <Link href="/dashboard/tests" className="font-medium text-brand hover:underline">
            Take your first test
          </Link>
        </EmptyState>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Test</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Rating</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((a) => {
                  const r = rating(a.percentage);
                  return (
                    <tr key={a.id} className="hover:bg-surface-2/60">
                      <td className="px-5 py-3.5 font-medium">{a.testTitle}</td>
                      <td className="px-5 py-3.5 text-muted">{KIND_LABEL[a.kind]}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-muted">{formatDate(a.submittedAt)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 tabular-nums">
                        {a.score}/{a.total} <span className="text-muted">({a.percentage}%)</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={r.tone}>{r.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/dashboard/results/${a.id}`} className="font-medium text-brand hover:underline">
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
