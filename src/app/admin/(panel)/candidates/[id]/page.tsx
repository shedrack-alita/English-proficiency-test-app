import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { listResults } from "@/lib/admin-data";
import { getCandidate } from "@/lib/data";
import { removeCandidate, resetCandidateTest } from "@/app/admin/actions";
import { CandidateForm, ConfirmButton } from "../../forms";
import { ResultsTable } from "../../results-table";

export const metadata = { title: "Candidate" };

export default async function CandidatePage({ params }: PageProps<"/admin/candidates/[id]">) {
  const id = Number((await params).id);
  const candidate = await getCandidate(id);
  if (!candidate) notFound();
  const results = await listResults({ candidateId: id });

  // Mock examinations this candidate has used up, which an admin can reopen.
  const takenOfficial = [...new Map(results.filter((r) => r.kind === "official").map((r) => [r.testId, r.testTitle]))];

  return (
    <>
      <Link href="/admin/candidates" className="btn-ghost -ml-3 mb-4 px-3">
        <ArrowLeft className="size-4" aria-hidden /> All candidates
      </Link>
      <PageHeader
        title={candidate.fullName}
        subtitle={[candidate.email, candidate.course, candidate.department, candidate.gender].filter(Boolean).join(" · ")}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card p-6 lg:col-span-3">
          <h2 className="mb-5 font-semibold">Profile & access</h2>
          <CandidateForm candidate={candidate} />
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <h2 className="font-semibold">Allow a retake</h2>
            <p className="mt-1 text-sm text-muted">
              Mock examinations allow one attempt. Resetting removes this candidate&apos;s attempt so they can sit it again.
            </p>
            {takenOfficial.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No mock examinations taken yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {takenOfficial.map(([testId, title]) => (
                  <li key={testId} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{title}</span>
                    <form action={resetCandidateTest}>
                      <input type="hidden" name="candidateId" value={id} />
                      <input type="hidden" name="testId" value={testId} />
                      <ConfirmButton message={`Reset ${candidate.fullName}'s attempt at "${title}"? Their result for it will be deleted.`} className="btn-ghost px-2.5 py-1.5">
                        Reset
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-semibold">Delete candidate</h2>
            <p className="mt-1 text-sm text-muted">Removes the candidate with all their results and feedback.</p>
            <form action={removeCandidate} className="mt-4">
              <input type="hidden" name="id" value={id} />
              <ConfirmButton message={`Delete ${candidate.fullName} and all their results? This can't be undone.`}>
                <Trash2 className="size-4" aria-hidden /> Delete candidate
              </ConfirmButton>
            </form>
          </section>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Results</h2>
        <ResultsTable rows={results} showCandidate={false} />
      </section>
    </>
  );
}
