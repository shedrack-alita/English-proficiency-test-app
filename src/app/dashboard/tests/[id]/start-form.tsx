"use client";

import { useActionState, useState } from "react";
import { Check, Clock3 } from "lucide-react";
import { beginTest } from "@/app/actions";
import { Alert, cx } from "@/components/ui";
import {
  PRACTICE_MAX_MINUTES,
  PRACTICE_MAX_QUESTIONS,
  PRACTICE_QUESTION_PRESETS,
  PRACTICE_TIME_PRESETS,
  suggestedMinutes,
  type TestKind,
} from "@/lib/constants";

type Props = {
  testId: number;
  kind: TestKind;
  resume?: boolean;
  maxQuestions?: number;
  /** Topics the candidate can choose from (practice tests covering more than one topic). */
  topics?: { topic: string; count: number }[];
  /** Topics ticked when the form opens; defaults to all. */
  initialTopics?: string[];
};

export function StartForm({ testId, kind, resume, maxQuestions = 1, topics = [], initialTopics }: Props) {
  const [state, action, pending] = useActionState(beginTest, undefined);
  const choosable = topics.length > 1;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialTopics?.length ? initialTopics : topics.map((t) => t.topic)),
  );
  const pool = choosable ? topics.filter((t) => selected.has(t.topic)).reduce((sum, t) => sum + t.count, 0) : maxQuestions;
  const cap = Math.min(pool, PRACTICE_MAX_QUESTIONS);

  const [requested, setRequested] = useState(20);
  const questions = Math.max(1, Math.min(requested, cap));
  const questionPresets = PRACTICE_QUESTION_PRESETS.filter((n) => n < cap).concat(cap > 0 ? [cap] : []);

  // Time follows the suggested pace until the candidate picks one themselves.
  const [chosenMinutes, setChosenMinutes] = useState<number | null>(null);
  const suggested = suggestedMinutes(questions);
  const minutes = chosenMinutes ?? suggested;

  const toggle = (topic: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });

  const chip = (active: boolean) =>
    cx(
      "rounded-xl border px-4 py-2 text-sm font-medium tabular-nums transition",
      active ? "border-brand bg-brand-soft text-brand-strong" : "border-line hover:bg-surface-2",
    );

  return (
    <form action={action} className="space-y-7">
      <input type="hidden" name="testId" value={testId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      {kind === "practice" && (
        <>
          {choosable && (
            <fieldset>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <legend className="text-sm font-semibold text-ink">
                  1. Topics <span className="font-normal text-muted">({selected.size} of {topics.length} selected)</span>
                </legend>
                <div className="flex gap-1 text-sm">
                  <button type="button" className="rounded-lg px-2 py-1 font-medium text-brand hover:bg-brand-soft" onClick={() => setSelected(new Set(topics.map((t) => t.topic)))}>
                    All topics
                  </button>
                  <button type="button" className="rounded-lg px-2 py-1 font-medium text-muted hover:bg-surface-2" onClick={() => setSelected(new Set())}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {topics.map(({ topic, count }) => {
                  const on = selected.has(topic);
                  return (
                    <label
                      key={topic}
                      className={cx(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition has-focus-visible:outline-2 has-focus-visible:outline-brand",
                        on ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2",
                      )}
                    >
                      <input type="checkbox" name="topics" value={topic} checked={on} onChange={() => toggle(topic)} className="sr-only" />
                      <span
                        className={cx("grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface")}
                        aria-hidden
                      >
                        {on && <Check className="size-3.5" />}
                      </span>
                      <span className="flex-1 font-medium">{topic}</span>
                      <span className="tabular-nums text-muted">{count}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <fieldset disabled={pool === 0}>
            <legend className="mb-2 text-sm font-semibold text-ink">
              {choosable ? "2." : "1."} Number of questions{" "}
              <span className="font-normal text-muted">({pool.toLocaleString()} available{pool > cap ? `, up to ${cap} per set` : ""})</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {questionPresets.map((n) => (
                <button key={n} type="button" onClick={() => setRequested(n)} className={chip(questions === n)}>
                  {n === pool ? `All ${n}` : n}
                </button>
              ))}
              <input
                type="number"
                name="questions"
                min={1}
                max={Math.max(cap, 1)}
                value={questions}
                onChange={(e) => setRequested(Number(e.target.value))}
                aria-label="Custom number of questions"
                className="input w-24"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">
              {choosable ? "3." : "2."} Time limit{" "}
              <span className="font-normal text-muted">(suggested {suggested} min for {questions} questions)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {PRACTICE_TIME_PRESETS.map((m) => (
                <button key={m} type="button" onClick={() => setChosenMinutes(m)} className={chip(minutes === m)}>
                  {m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`}
                </button>
              ))}
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="number"
                  name="minutes"
                  min={1}
                  max={PRACTICE_MAX_MINUTES}
                  value={minutes}
                  onChange={(e) => setChosenMinutes(Number(e.target.value))}
                  aria-label="Custom time limit in minutes"
                  className="input w-24"
                />
                minutes
              </label>
              {chosenMinutes !== null && chosenMinutes !== suggested && (
                <button type="button" onClick={() => setChosenMinutes(null)} className="text-sm font-medium text-brand hover:underline">
                  Use suggested
                </button>
              )}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <span className="font-semibold">Your set:</span>
            <span>{questions} questions</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden /> {minutes} minutes
            </span>
            <span className="text-muted">
              {choosable && selected.size === topics.length ? "All topics" : `${selected.size} topic${selected.size === 1 ? "" : "s"}`}
            </span>
          </div>
        </>
      )}

      <button type="submit" disabled={pending || (kind === "practice" && pool === 0)} className="btn-primary px-6 py-3 text-base">
                {pending ? "Preparing…" : resume ? "Resume attempt" : kind === "official" ? "Start mock exam" : "Start practice"}
      </button>
      {kind === "practice" && choosable && pool === 0 && <p className="text-sm text-muted">Select at least one topic to start.</p>}
    </form>
  );
}
