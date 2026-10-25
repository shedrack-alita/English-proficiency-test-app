"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import {
  importCsv,
  saveCandidate,
  saveQuestion,
  saveTest,
  changeAdminPassword,
  type AdminFormState,
} from "@/app/admin/actions";
import { Alert, cx } from "@/components/ui";
import { GENDERS, type CandidateAccess, type TestKind } from "@/lib/constants";
import type { AdminQuestion } from "@/lib/admin-data";

/** Submit button that asks for confirmation before a destructive action. */
export function ConfirmButton({ message, children, className }: { message: string; children: ReactNode; className?: string }) {
  return (
    <button
      type="submit"
      className={className ?? "btn-ghost text-bad hover:bg-bad-soft hover:text-bad"}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

function FormMessages({ state }: { state: AdminFormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

/* Test details ----------------------------------------------------- */

export type TestFormValues = {
  id?: number;
  title: string;
  category: string;
  description: string;
  kind: TestKind;
  timeLimit: number;
  questionLimit: number;
  shuffle: boolean;
};

export function TestForm({ initial, categories }: { initial: TestFormValues; categories: string[] }) {
  const [state, action, pending] = useActionState(saveTest, undefined);
  const [kind, setKind] = useState<TestKind>(initial.kind);

  return (
    <form action={action} className="space-y-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <FormMessages state={state} />

      <fieldset>
        <legend className="label">Type</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["official", "Mock examination", "Timed, one attempt, fixed number of questions."],
              ["practice", "Practice", "Unlimited retakes; candidates choose length and time."],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={cx(
                "cursor-pointer rounded-xl border p-3.5 transition has-focus-visible:outline-2 has-focus-visible:outline-brand",
                kind === value ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2",
              )}
            >
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              <div className="text-sm font-semibold">{label}</div>
              <div className="mt-0.5 text-xs text-muted">{hint}</div>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className="label">
            Title
          </label>
          <input id="title" name="title" required defaultValue={initial.title} className="input" />
        </div>
        <div>
          <label htmlFor="category" className="label">
            Category
          </label>
          <input id="category" name="category" list="categories" defaultValue={initial.category} className="input" placeholder="e.g. Topic Practice" />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea id="description" name="description" rows={3} defaultValue={initial.description} className="input resize-y" />
      </div>

      {kind === "official" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="timeLimit" className="label">
              Time limit (minutes)
            </label>
            <input id="timeLimit" name="timeLimit" type="number" min={1} max={600} required defaultValue={initial.timeLimit || 60} className="input" />
          </div>
          <div>
            <label htmlFor="questionLimit" className="label">
              Questions shown
            </label>
            <input id="questionLimit" name="questionLimit" type="number" min={1} required defaultValue={initial.questionLimit || 50} className="input" />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="shuffle" defaultChecked={initial.shuffle} className="size-4 accent-brand" />
        Give each candidate their own question and option order
        <span className="text-muted">(off keeps the paper order for everyone)</span>
      </label>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : initial.id ? "Save details" : "Create test"}
      </button>
    </form>
  );
}

/* Questions -------------------------------------------------------- */

const LETTERS = ["A", "B", "C", "D"] as const;

export function QuestionForm({
  testId,
  question,
  topics,
  defaultTopic = "",
}: {
  testId: number;
  question?: AdminQuestion;
  topics: string[];
  defaultTopic?: string;
}) {
  const [state, action, pending] = useActionState(saveQuestion, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success && !question) formRef.current?.reset();
  }, [state, question]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="testId" value={testId} />
      {question && <input type="hidden" name="id" value={question.id} />}
      <FormMessages state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="topic" className="label">
            Topic
          </label>
          <input id="topic" name="topic" list="topics" defaultValue={question?.topic ?? defaultTopic} className="input" placeholder="e.g. Concord" />
          <datalist id="topics">
            {topics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="instruction" className="label">
            Instruction <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="instruction" name="instruction" defaultValue={question?.instruction} className="input" placeholder="e.g. Choose the correct question tag." />
        </div>
      </div>

      <div>
        <label htmlFor="prompt" className="label">
          Question
        </label>
        <textarea id="prompt" name="prompt" rows={2} defaultValue={question?.prompt} className="input resize-y" placeholder="Wrap underlined words in **double asterisks**." />
        <p className="mt-1 text-xs text-muted">
          Wrap words in <code className="rounded bg-surface-2 px-1">**double asterisks**</code> to show them bold and underlined.
        </p>
      </div>

      <fieldset>
        <legend className="label">Options — select the correct one</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LETTERS.map((k) => (
            <div key={k} className="flex items-center gap-2 rounded-xl border border-line p-2 pl-3 has-checked:border-ok has-checked:bg-ok-soft">
              <input
                type="radio"
                name="answer"
                value={k}
                defaultChecked={question?.answer === k}
                aria-label={`Option ${k.toLowerCase()} is correct`}
                className="size-4 accent-[var(--ok)]"
              />
              <span className="w-4 text-sm font-semibold text-muted">{k.toLowerCase()}.</span>
              <input name={`choice${k}`} required defaultValue={question?.choices[k]} className="input border-0 bg-transparent px-1 py-1.5 focus:ring-0" aria-label={`Option ${k.toLowerCase()}`} />
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="explanation" className="label">
          Explanation <span className="font-normal text-muted">(shown in the results report)</span>
        </label>
        <textarea id="explanation" name="explanation" rows={2} defaultValue={question?.explanation} className="input resize-y" placeholder="Why the correct option is right (and the others wrong)." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tip" className="label">
            Tip <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="tip" name="tip" defaultValue={question?.tip} className="input" placeholder="How to answer similar questions" />
        </div>
        <div>
          <label htmlFor="source" className="label">
            Source <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="source" name="source" defaultValue={question?.source} className="input" placeholder="e.g. UI PG sample questions (2013)" />
        </div>
      </div>

      <details className="rounded-xl border border-line px-4 py-3" open={!!question?.passage}>
        <summary className="cursor-pointer text-sm font-medium">Passage (optional)</summary>
        <textarea
          name="passage"
          rows={6}
          defaultValue={question?.passage}
          className="input mt-3 resize-y"
          placeholder="Reading or cloze passage shown beside the question. Mark blanks like (61)."
        />
      </details>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : question ? "Save question" : "Add question"}
      </button>
    </form>
  );
}

export function CsvImportForm({ testId, topics }: { testId: number; topics: string[] }) {
  const [state, action, pending] = useActionState(importCsv, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="testId" value={testId} />
      <FormMessages state={state} />
      <div>
        <label htmlFor="file" className="label">
          CSV file
        </label>
        <input id="file" name="file" type="file" accept=".csv,text/csv" required className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-strong" />
      </div>
      <div>
        <label htmlFor="csv-topic" className="label">
          Topic for rows without one <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="csv-topic" name="topic" list="csv-topics" className="input" />
        <datalist id="csv-topics">
          {topics.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <p className="text-xs text-muted">
        Columns: <code>question, choice_a, choice_b, choice_c, choice_d, correct_answer</code>, optionally{" "}
        <code>topic, instruction, passage, explanation, tip, source</code>. The correct answer can be A–D or the option text. Duplicate questions are skipped.
      </p>
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Importing…" : "Import CSV"}
      </button>
    </form>
  );
}

/* Candidates ------------------------------------------------------- */

export function CandidateForm({
  candidate,
}: {
  candidate: {
    id: number;
    fullName: string;
    email: string;
    course: string;
    department: string;
    gender: string;
    access: CandidateAccess;
    status: string;
  };
}) {
  const [state, action, pending] = useActionState(saveCandidate, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={candidate.id} />
      <FormMessages state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fullName" className="label">
            Full name
          </label>
          <input id="fullName" name="fullName" required defaultValue={candidate.fullName} className="input" />
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" required defaultValue={candidate.email} className="input" />
        </div>
        <div>
          <label htmlFor="course" className="label">
            Applied course of study
          </label>
          <input id="course" name="course" maxLength={120} defaultValue={candidate.course} className="input" />
        </div>
        <div>
          <label htmlFor="department" className="label">
            Applied department
          </label>
          <input id="department" name="department" maxLength={120} defaultValue={candidate.department} className="input" />
        </div>
        <div>
          <label htmlFor="gender" className="label">
            Gender
          </label>
          <select id="gender" name="gender" defaultValue={candidate.gender} className="input">
            <option value="">Not given</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="access" className="label">
            Can take
          </label>
          <select id="access" name="access" defaultValue={candidate.access} className="input">
            <option value="both">Mock exams and practice</option>
            <option value="official">Mock exams only</option>
            <option value="practice">Practice only</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">
            Status
          </label>
          <select id="status" name="status" defaultValue={candidate.status} className="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive (can&apos;t sign in)</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Save candidate"}
      </button>
    </form>
  );
}

/* Settings --------------------------------------------------------- */

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeAdminPassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <FormMessages state={state} />
      {(
        [
          ["current", "Current password", "current-password"],
          ["next", "New password", "new-password"],
          ["confirm", "Confirm new password", "new-password"],
        ] as const
      ).map(([name, label, autoComplete]) => (
        <div key={name}>
          <label htmlFor={name} className="label">
            {label}
          </label>
          <input id={name} name={name} type="password" required autoComplete={autoComplete} className="input" />
        </div>
      ))}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
