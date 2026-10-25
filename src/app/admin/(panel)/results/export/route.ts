import { getRanking, listResults } from "@/lib/admin-data";
import { KIND_LABEL, rating } from "@/lib/constants";
import { toCsv } from "@/lib/csv";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  if (!(await getSession("admin"))) return new Response("Unauthorized", { status: 401 });

  const testId = Number(new URL(request.url).searchParams.get("test")) || 0;
  const rows = testId ? await getRanking(testId) : await listResults();
  const csv = toCsv([
    ["Rank", "Candidate", "Email", "Test", "Type", "Score", "Total", "Percentage", "Rating", "Submitted"],
    ...rows.map((r, i) => [
      testId ? i + 1 : "",
      r.candidateName,
      r.candidateEmail,
      r.testTitle,
      KIND_LABEL[r.kind],
      r.score,
      r.total,
      r.percentage,
      rating(r.percentage).label,
      new Date(r.submittedAt).toISOString(),
    ]),
  ]);

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eptprep-results${testId ? `-test-${testId}` : ""}.csv"`,
    },
  });
}
