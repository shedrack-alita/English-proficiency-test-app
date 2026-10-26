import { listCandidates } from "@/lib/admin-data";
import { toCsv } from "@/lib/csv";
import { getSession } from "@/lib/session";

const ACCESS_LABEL = { both: "Mock + practice", official: "Mock only", practice: "Practice only" } as const;

/** Read-only CSV of candidate details; honours the Candidates page search (?q=). */
export async function GET(request: Request) {
  if (!(await getSession("admin"))) return new Response("Unauthorized", { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const candidates = await listCandidates(q);
  const csv = toCsv([
    [
      "Full name",
      "Email",
      "Applied course of study",
      "Applied department",
      "Gender",
      "Access",
      "Status",
      "Joined (UTC)",
      "Attempts",
      "Average score (%)",
      "Last active (UTC)",
    ],
    ...candidates.map((c) => [
      c.fullName,
      c.email,
      c.course,
      c.department,
      c.gender,
      ACCESS_LABEL[c.access],
      c.status === "active" ? "Active" : "Inactive",
      c.createdAt,
      c.attempts,
      c.avgScore ?? "",
      c.lastActive ? new Date(c.lastActive).toISOString().slice(0, 19).replace("T", " ") : "",
    ]),
  ]);

  const day = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="eptprep-candidates-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
