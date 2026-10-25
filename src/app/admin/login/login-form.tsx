"use client";

import { useActionState } from "react";
import { adminLogin } from "@/app/admin/actions";
import { Alert } from "@/components/ui";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <label htmlFor="username" className="label">
          Username
        </label>
        <input id="username" name="username" autoComplete="username" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
