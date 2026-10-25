"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, CloudOff, LayoutGrid, Loader2, X } from "lucide-react";
import { recordAnswer, submitAttempt } from "@/app/actions";
import { Logo, ProgressBar, RichText, cx } from "@/components/ui";
import { KIND_LABEL, type TestKind } from "@/lib/constants";
import type { ExamQuestion, Letter } from "@/lib/data";

type Exam = {
  attemptId: number;
  testTitle: string;
  kind: TestKind;
  expiresAt: number;
  serverNow: number;
  questions: ExamQuestion[];
  answers: Record<number, Letter>;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function ExamRunner({ exam }: { exam: Exam }) {
  const { questions } = exam;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Letter>>(exam.answers);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [submitting, startSubmit] = useTransition();

  // Correct for clock differences between this device and the server.
  const offset = useRef(0);
  useEffect(() => {
    offset.current = exam.serverNow - Date.now();
  }, [exam.serverNow]);
  const remainingMs = useCallback(() => exam.expiresAt - (Date.now() + offset.current), [exam.expiresAt]);
  const [remaining, setRemaining] = useState(exam.expiresAt - exam.serverNow);

  const question = questions[index];
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const unanswered = questions.length - answeredCount;

  const submit = useCallback(() => {
    startSubmit(async () => {
      await submitAttempt(exam.attemptId);
    });
  }, [exam.attemptId]);

  // Countdown; auto-submit when time runs out.
  useEffect(() => {
    const tick = () => {
      const left = remainingMs();
      setRemaining(left);
      if (left <= 0) {
        setTimedOut(true);
        return true;
      }
      return false;
    };
    if (tick()) return;
    const id = setInterval(() => tick() && clearInterval(id), 1000);
    return () => clearInterval(id);
  }, [remainingMs]);

  useEffect(() => {
    if (timedOut) submit();
  }, [timedOut, submit]);

  const choose = useCallback(
    async (questionId: number, choice: Letter) => {
      if (timedOut) return;
      setAnswers((prev) => ({ ...prev, [questionId]: choice }));
      setSaveState("saving");
      try {
        const res = await recordAnswer(exam.attemptId, questionId, choice);
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    },
    [exam.attemptId, timedOut],
  );

  const go = useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(questions.length - 1, i)));
      setNavOpen(false);
    },
    [questions.length],
  );

  // Keyboard: A–D or 1–4 to answer, arrow keys to move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirmOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      const key = e.key.toUpperCase();
      const pos = "ABCD".indexOf(key) >= 0 ? "ABCD".indexOf(key) : "1234".indexOf(key);
      if (pos >= 0 && question.options[pos]) {
        e.preventDefault();
        choose(question.id, question.options[pos].key);
      } else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [question, index, choose, go, confirmOpen]);

  const lowTime = remaining <= 5 * 60_000;

  const navigator = (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 flex justify-between text-xs font-medium text-muted">
          <span>
            {answeredCount} of {questions.length} answered
          </span>
          <span>{Math.round((answeredCount / questions.length) * 100)}%</span>
        </div>
        <ProgressBar value={(answeredCount / questions.length) * 100} />
      </div>
      <div className="grid grid-cols-6 gap-1.5" role="list" aria-label="Questions">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Question ${i + 1}${answers[q.id] ? ", answered" : ""}`}
            aria-current={i === index ? "true" : undefined}
            className={cx(
              "h-9 rounded-lg border text-xs font-semibold tabular-nums transition",
              i === index && "ring-2 ring-brand ring-offset-2 ring-offset-surface",
              answers[q.id] ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface hover:bg-surface-2",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-brand" /> Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border border-line" /> Not answered
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo compact href="#" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{exam.testTitle}</div>
            <div className="flex items-center gap-2 text-xs text-muted">
              {KIND_LABEL[exam.kind]}
              <SaveIndicator state={saveState} />
            </div>
          </div>
          <div
            role="timer"
            aria-live={lowTime ? "polite" : "off"}
            className={cx(
              "flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-sm font-semibold tabular-nums",
              remaining <= 60_000 ? "bg-bad text-white" : lowTime ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink",
            )}
          >
            <Clock3 className="size-4" aria-hidden />
            {formatClock(remaining)}
          </div>
          <button type="button" onClick={() => setNavOpen(true)} className="btn-secondary px-3 lg:hidden" aria-label="Show question list">
            <LayoutGrid className="size-4" />
          </button>
          <button type="button" onClick={() => setConfirmOpen(true)} className="btn-primary hidden sm:inline-flex" disabled={submitting}>
            Submit
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_300px]">
        <main className="min-w-0">
          <div className={cx("grid gap-6", question.passage && "xl:grid-cols-2")}>
            {question.passage && <Passage text={question.passage} highlight={question.number} />}

            <section aria-labelledby="question-heading" className="min-w-0">
              <p id="question-heading" className="mb-4 text-sm font-medium text-muted">
                Question {index + 1} of {questions.length}
              </p>

              {question.instruction && (
                <p className="mb-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
                  <RichText text={question.instruction} />
                </p>
              )}

              {question.prompt && (
                <h2 className="text-xl font-medium leading-relaxed text-ink sm:text-2xl">
                  <RichText text={question.prompt} />
                </h2>
              )}

              <div role="radiogroup" aria-labelledby="question-heading" className="mt-6 space-y-3">
                {question.options.map((opt, i) => {
                  const selected = answers[question.id] === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={timedOut}
                      onClick={() => choose(question.id, opt.key)}
                      className={cx(
                        "flex w-full items-center gap-4 rounded-2xl border-2 bg-surface px-4 py-3.5 text-left transition",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        selected ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40 hover:bg-surface-2",
                      )}
                    >
                      <span
                        className={cx(
                          "grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold",
                          selected ? "bg-brand text-brand-ink" : "bg-surface-2 text-muted",
                        )}
                      >
                        {selected ? <Check className="size-4" /> : "abcd"[i]}
                      </span>
                      <span className="text-base">
                        <RichText text={opt.text} />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="btn-secondary">
                  <ChevronLeft className="size-4" aria-hidden /> Previous
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => go(index + 1)} disabled={index === questions.length - 1} className="btn-secondary">
                    Next <ChevronRight className="size-4" aria-hidden />
                  </button>
                  <button type="button" onClick={() => setConfirmOpen(true)} className="btn-primary" disabled={submitting}>
                    Submit
                  </button>
                </div>
              </div>
            </section>
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="card sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto p-5">{navigator}</div>
        </aside>
      </div>

      {/* Mobile question list */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Question list">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-surface p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Questions</h2>
              <button type="button" onClick={() => setNavOpen(false)} className="btn-ghost px-2" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            {navigator}
            <button type="button" onClick={() => setConfirmOpen(true)} className="btn-primary mt-6 w-full" disabled={submitting}>
              Submit
            </button>
          </div>
        </div>
      )}

      {/* Submit confirmation */}
      {confirmOpen && !timedOut && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && setConfirmOpen(false)} />
          <div className="card relative w-full max-w-md p-6 shadow-xl">
            <h2 id="confirm-title" className="text-lg font-semibold">
              Submit your answers?
            </h2>
            {unanswered > 0 ? (
              <p className="mt-2 flex gap-2 text-sm text-warn">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                You have {unanswered} unanswered question{unanswered === 1 ? "" : "s"}. They will be marked incorrect.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">You&apos;ve answered every question. You can&apos;t change your answers after submitting.</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                Keep working
              </button>
              <button type="button" className="btn-primary" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {submitting ? "Submitting…" : "Submit now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time up */}
      {timedOut && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="timeup-title">
          <div className="card w-full max-w-sm p-6 text-center shadow-xl">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-warn-soft text-warn">
              <Clock3 className="size-6" aria-hidden />
            </span>
            <h2 id="timeup-title" className="mt-4 text-lg font-semibold">
              Time&apos;s up
            </h2>
            <p className="mt-1 text-sm text-muted">Submitting your answers…</p>
            <Loader2 className="mx-auto mt-4 size-5 animate-spin text-brand" aria-hidden />
          </div>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" aria-hidden /> Saving
      </span>
    );
  if (state === "saved")
    return (
      <span className="inline-flex items-center gap-1 text-ok">
        <Check className="size-3" aria-hidden /> Saved
      </span>
    );
  if (state === "error")
    return (
      <span className="inline-flex items-center gap-1 text-bad">
        <CloudOff className="size-3" aria-hidden /> Not saved, choose again
      </span>
    );
  return null;
}

/** Reading passage; the blank for the current question, e.g. "(61)", is highlighted. */
function Passage({ text, highlight }: { text: string; highlight: number }) {
  const [title, ...rest] = text.split("\n\n");
  const hasTitle = rest.length > 0 && title.length < 80;
  const body = hasTitle ? rest.join("\n\n") : text;
  return (
    <section aria-label="Passage" className="card max-h-[70vh] overflow-y-auto p-6 xl:sticky xl:top-24">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <BookOpen className="size-4" aria-hidden /> Passage
      </div>
      {hasTitle && <h3 className="mb-3 font-semibold">{title}</h3>}
      {body.split("\n\n").map((para, i) => (
        <p key={i} className="mb-3 leading-relaxed last:mb-0">
          {para.split(/(\(\d+\))/g).map((part, j) =>
            part === `(${highlight})` ? (
              <mark key={j} className="rounded bg-accent/30 px-1 font-semibold text-ink">
                {part}
              </mark>
            ) : /^\(\d+\)$/.test(part) ? (
              <span key={j} className="font-medium text-muted">
                {part}
              </span>
            ) : (
              part
            ),
          )}
        </p>
      ))}
    </section>
  );
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
