import Link from "next/link";
import type { Metadata } from "next";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { KIND_LABEL } from "@/lib/constants";
import { getAttemptCounts } from "@/lib/admin-data";
import { getAllTests } from "@/lib/data";

export const metadata: Metadata = { title: "Tests & questions" };

export default async function AdminTestsPage() {
  const [tests, attempts] = await Promise.all([getAllTests(), getAttemptCounts()]);

  return (
    <>
      <PageHeader
        title="Tests & questions"
        subtitle="Create tests, edit questions and import question banks from CSV."
        actions={
          <Link href="/admin/tests/new" className="btn-primary">
            New test
          </Link>
        }
      />
      {tests.length === 0 ? (
        <EmptyState title="No tests yet" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Test</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Questions</th>
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-5 py-3 font-semibold">Attempts</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tests.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/tests/${t.id}`} className="font-medium hover:text-brand">
                        {t.title}
                      </Link>
                      <div className="text-xs text-muted">{t.category || "—"}</div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={t.kind === "official" ? "brand" : "neutral"}>{KIND_LABEL[t.kind]}</Badge>
                    </td>
                    <td className="px-5 py-3 tabular-nums">
                      {t.questionCount}
                      {t.kind === "official" && t.questionLimit < t.questionCount && (
                        <span className="text-muted"> (shows {t.questionLimit})</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted">{t.kind === "official" ? `${t.timeLimit} min` : "Candidate picks"}</td>
                    <td className="px-5 py-3 tabular-nums">{attempts.get(t.id) ?? 0}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/tests/${t.id}`} className="font-medium text-brand hover:underline">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
