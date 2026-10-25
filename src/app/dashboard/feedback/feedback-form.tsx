"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendFeedback } from "@/app/actions";
import { Alert } from "@/components/ui";

export function FeedbackForm({ remaining }: { remaining: number }) {
  const [state, action, pending] = useActionState(sendFeedback, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  if (remaining === 0 && !state?.success) {
    return <p className="text-sm text-muted">You&apos;ve used all your feedback messages. Thank you for sharing your thoughts!</p>;
  }

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}
      <div>
        <label htmlFor="message" className="label">
          Your feedback
        </label>
        <textarea id="message" name="message" rows={5} maxLength={1000} required className="input resize-y" placeholder="What did you think of the questions, the timer, the results…?" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="anonymous" className="size-4 accent-brand" /> Send anonymously
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{remaining} left</span>
          <button type="submit" disabled={pending || remaining === 0} className="btn-primary">
            {pending ? "Sending…" : "Send feedback"}
          </button>
        </div>
      </div>
    </form>
  );
}
