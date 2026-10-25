import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { MAX_FEEDBACKS } from "@/lib/constants";
import { getFeedbacks } from "@/lib/data";
import { requireCandidate } from "@/lib/session";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Feedback" };

export default async function FeedbackPage() {
  const candidate = await requireCandidate();
  const feedbacks = await getFeedbacks(candidate.id);
  const remaining = Math.max(0, MAX_FEEDBACKS - feedbacks.length);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Feedback" subtitle="Tell us what's working and what could be better." />
      <div className="card p-6">
        <FeedbackForm remaining={remaining} />
      </div>

      {feedbacks.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Sent</h2>
          <ul className="space-y-3">
            {feedbacks.map((f) => (
              <li key={f.id} className="card p-4">
                <p className="whitespace-pre-line text-sm">{f.message}</p>
                <p className="mt-2 text-xs text-muted">
                  Sent as {f.displayName} · {f.createdAt.slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
