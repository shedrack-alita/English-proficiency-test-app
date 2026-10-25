import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRanking, listResults } from "@/lib/admin-data";
import { getAllTests } from "@/lib/data";
import { ResultsTable } from "../results-table";

export const metadata: Metadata = { title: "Results & rankings" };

export default async function AdminResultsPage({ searchParams }: PageProps<"/admin/results">) {
  const testId = Number((await searchParams).test) || 0;
  const tests = await getAllTests();
  const test = tests.find((t) => t.id === testId);
  const rows = test ? await getRanking(test.id) : await listResults();

  return (
    <>
      <PageHeader
        title="Results & rankings"
        subtitle={test ? `Ranking for ${test.title}: each candidate's best score.` : "Every submitted attempt, newest first."}
        actions={
          <a href={`/admin/results/export${test ? `?test=${test.id}` : ""}`} className="btn-secondary">
            Export CSV
          </a>
        }
      />

      <form className="mb-5 flex flex-wrap items-end gap-2">
        <div className="w-full max-w-sm">
          <label htmlFor="test" className="label">
            Rank by test
          </label>
          <select id="test" name="test" defaultValue={testId || ""} className="input">
            <option value="">All tests (every attempt)</option>
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          Show
        </button>
      </form>

      <ResultsTable rows={rows} showTest={!test} rank={!!test} />
    </>
  );
}
