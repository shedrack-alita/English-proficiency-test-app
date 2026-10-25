"use client";

import { useActionState } from "react";
import { loginCandidate } from "@/app/actions";
import { Alert } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginCandidate, undefined);

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email} key={state?.email} className="input" placeholder="you@example.com" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" placeholder="••••••••" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
                {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
