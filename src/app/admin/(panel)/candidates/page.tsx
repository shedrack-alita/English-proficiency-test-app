import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Badge, EmptyState, PageHeader, StatCard, formatDate } from "@/components/ui";
import { getSignupStats, listCandidates } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Candidates" };

const ACCESS_LABEL = { both: "Mock + practice", official: "Mock only", practice: "Practice only" } as const;

export default async function CandidatesPage({ searchParams }: PageProps<"/admin/candidates">) {
  const q = String((await searchParams).q ?? "");
  const [candidates, signups] = await Promise.all([listCandidates(q), getSignupStats()]);

  return (
    <>
      <PageHeader title="Candidates" subtitle="Everyone who has created an EPTPREP account." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered" value={signups.total} hint="All accounts" />
        <StatCard label="Joined today" value={signups.today} hint="Since midnight (UTC)" />
        <StatCard label="Last 7 days" value={signups.week} hint={`${signups.month} in the last 30 days`} />
        <StatCard label="Have taken a test" value={signups.tested} hint="Submitted at least one attempt" />
      </div>

      <form className="mb-5 flex max-w-lg gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Search by name, email, course or department" aria-label="Search candidates" className="input pl-9" />
        </div>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>

      {candidates.length === 0 ? (
        <EmptyState title={q ? "No candidates match your search" : "No candidates yet"} />
      ) : (
        <>
        <p className="mb-3 text-sm text-muted">
          {q ? `${candidates.length} of ${signups.total} candidates match "${q}"` : `${candidates.length} candidates, newest first`}
        </p>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Candidate</th>
                  <th className="px-5 py-3 font-semibold">Applied for</th>
                  <th className="px-5 py-3 font-semibold">Gender</th>
                  <th className="px-5 py-3 font-semibold">Access</th>
                  <th className="px-5 py-3 font-semibold">Joined</th>
                  <th className="px-5 py-3 font-semibold">Attempts</th>
                  <th className="px-5 py-3 font-semibold">Average</th>
                  <th className="px-5 py-3 font-semibold">Last active</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/candidates/${c.id}`} className="font-medium hover:text-brand">
                        {c.fullName}
                      </Link>
                      <div className="text-xs text-muted">{c.email}</div>
                    </td>
                    <td className="max-w-64 px-5 py-3">
                      {c.course || c.department ? (
                        <>
                          <div className="truncate">{c.course || "—"}</div>
                          <div className="truncate text-xs text-muted">{c.department}</div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{c.gender || "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-muted">{ACCESS_LABEL[c.access]}</span>
                      {c.status !== "active" && (
                        <span className="ml-2">
                          <Badge tone="red">Inactive</Badge>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{formatDate(Date.parse(`${c.createdAt.replace(" ", "T")}Z`))}</td>
                    <td className="px-5 py-3 tabular-nums">{c.attempts}</td>
                    <td className="px-5 py-3 tabular-nums">{c.avgScore === null ? "—" : `${c.avgScore}%`}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{c.lastActive ? formatDate(c.lastActive) : "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/admin/candidates/${c.id}`} className="font-medium text-brand hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </>
  );
}
