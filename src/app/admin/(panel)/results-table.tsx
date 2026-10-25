import Link from "next/link";
import { Badge, EmptyState, formatDate } from "@/components/ui";
import { KIND_LABEL, rating } from "@/lib/constants";
import type { ResultRow } from "@/lib/admin-data";

export function ResultsTable({
  rows,
  showCandidate = true,
  showTest = true,
  rank = false,
}: {
  rows: ResultRow[];
  showCandidate?: boolean;
  showTest?: boolean;
  rank?: boolean;
}) {
  if (rows.length === 0) return <EmptyState title="No results yet" />;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
            <tr>
              {rank && <th className="w-12 px-5 py-3 font-semibold">#</th>}
              {showCandidate && <th className="px-5 py-3 font-semibold">Candidate</th>}
              {showTest && <th className="px-5 py-3 font-semibold">Test</th>}
              <th className="px-5 py-3 font-semibold">Score</th>
              <th className="px-5 py-3 font-semibold">Rating</th>
              <th className="px-5 py-3 font-semibold">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => {
              const rt = rating(r.percentage);
              return (
                <tr key={r.id} className="hover:bg-surface-2/60">
                  {rank && <td className="px-5 py-3 font-semibold tabular-nums text-muted">{i + 1}</td>}
                  {showCandidate && (
                    <td className="px-5 py-3">
                      <Link href={`/admin/candidates/${r.candidateId}`} className="font-medium hover:text-brand">
                        {r.candidateName}
                      </Link>
                      <div className="text-xs text-muted">{r.candidateEmail}</div>
                    </td>
                  )}
                  {showTest && (
                    <td className="px-5 py-3">
                      <div className="font-medium">{r.testTitle}</div>
                      <div className="text-xs text-muted">{KIND_LABEL[r.kind]}</div>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-5 py-3 tabular-nums">
                    {r.score}/{r.total} <span className="text-muted">({r.percentage}%)</span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={rt.tone}>{rt.label}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDate(r.submittedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
