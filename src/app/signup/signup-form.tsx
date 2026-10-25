"use client";

import { useActionState } from "react";
import { signupCandidate } from "@/app/actions";
import { Alert } from "@/components/ui";
import { GENDERS } from "@/lib/constants";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupCandidate, undefined);

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <label htmlFor="fullName" className="label">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={state?.fullName}
          key={`n-${state?.fullName}`}
          className="input"
          placeholder="Ada Okafor"
        />
      </div>
      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
          key={`e-${state?.email}`}
          className="input"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="course" className="label">
          Applied course of study
        </label>
        <input
          id="course"
          name="course"
          required
          maxLength={120}
          defaultValue={state?.course}
          key={`c-${state?.course}`}
          className="input"
          placeholder="e.g. M.Sc. Public Health"
        />
      </div>
      <div>
        <label htmlFor="department" className="label">
          Applied department
        </label>
        <input
          id="department"
          name="department"
          required
          maxLength={120}
          defaultValue={state?.department}
          key={`d-${state?.department}`}
          className="input"
          placeholder="e.g. Epidemiology and Medical Statistics"
        />
      </div>
      <fieldset>
        <legend className="label">Gender</legend>
        <div className="flex flex-wrap gap-2" key={`g-${state?.gender}`}>
          {GENDERS.map((g) => (
            <label
              key={g}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand"
            >
              <input type="radio" name="gender" value={g} required defaultChecked={state?.gender === g} className="accent-brand" />
              {g}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} className="input" placeholder="At least 6 characters" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full py-3">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
