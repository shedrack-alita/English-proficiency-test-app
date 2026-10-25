import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { listAllFeedback } from "@/lib/admin-data";
import { removeFeedback } from "@/app/admin/actions";
import { ConfirmButton } from "../forms";

export const metadata: Metadata = { title: "Feedback" };

export default async function AdminFeedbackPage() {
  const feedback = await listAllFeedback();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Feedback" subtitle="What candidates have told you, newest first." />
      {feedback.length === 0 ? (
        <EmptyState title="No feedback yet" />
      ) : (
        <ul className="space-y-3">
          {feedback.map((f) => (
            <li key={f.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <p className="whitespace-pre-line">{f.message}</p>
                <form action={removeFeedback}>
                  <input type="hidden" name="id" value={f.id} />
                  <ConfirmButton message="Delete this feedback?" className="btn-ghost px-2.5 text-muted hover:bg-bad-soft hover:text-bad">
                    <Trash2 className="size-4" aria-label="Delete feedback" />
                  </ConfirmButton>
                </form>
              </div>
              <p className="mt-3 text-xs text-muted">
                {f.displayName}
                {f.candidateEmail && ` · ${f.candidateEmail}`} · {f.createdAt.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
