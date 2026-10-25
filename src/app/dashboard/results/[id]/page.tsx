import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { Alert, Badge, PageHeader, ProgressBar, RichText, cx, formatDate } from "@/components/ui";
import { KIND_LABEL, PASS_MARK, rating } from "@/lib/constants";
import { finalizeAttempt, getAttempt, getResult, getTest, isOpen, type Letter } from "@/lib/data";
import { requireCandidate } from "@/lib/session";

export const metadata = { title: "Result" };

export default async function ResultPage({ params, searchParams }: PageProps<"/dashboard/results/[id]">) {
  const candidate = await requireCandidate();
  const attemptId = Number((await params).id);
  let attempt = await getAttempt(attemptId);
  if (!attempt || attempt.candidateId !== candidate.id) notFound();
  if (attempt.submittedAt === null) {
    if (isOpen(attempt)) redirect(`/exam/${attempt.id}`);
    await finalizeAttempt(attempt.id);
    attempt = (await getAttempt(attemptId))!;
  }
  const test = await getTest(attempt.testId);
  if (!test) notFound();

  const result = await getResult(attempt);
  const r = rating(result.percentage);
  const justSubmitted = (await searchParams).submitted === "1";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard/results" className="btn-ghost -ml-3 mb-4 px-3">
        <ArrowLeft className="size-4" aria-hidden /> All results
      </Link>
      <PageHeader
        title={test.title}
        subtitle={`${KIND_LABEL[test.kind]} · submitted ${formatDate(attempt.submittedAt!)}`}
        actions={
          test.kind === "practice" && (
            <Link
              href={`/dashboard/tests?${result.topics.map((t) => `topic=${encodeURIComponent(t.topic)}`).join("&")}#practice`}
              className="btn-primary"
            >
              Practise again
            </Link>
          )
        }
      />

      {justSubmitted && (
        <div className="mb-6">
          <Alert tone="success">Your answers were submitted successfully.</Alert>
        </div>
      )}

      <div className="card grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center sm:p-8">
        <ScoreRing percentage={result.percentage} passed={result.passed} />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={r.tone}>{r.label}</Badge>
            <Badge tone={result.passed ? "green" : "red"}>{result.passed ? "Passed" : `Below ${PASS_MARK}%`}</Badge>
          </div>
          <div className="mt-3 text-3xl font-semibold tabular-nums">
            {result.score} <span className="text-lg font-normal text-muted">/ {result.total} correct</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            You answered {result.answered} of {result.total} questions.
            {result.answered < result.total && " Unanswered questions count as incorrect."}
          </p>
        </div>
      </div>

      <section className="card mt-6 p-6">
        <h2 className="font-semibold">Score by topic</h2>
        <ul className="mt-5 space-y-3.5">
          {result.topics.map((t) => (
            <li key={t.topic} className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem] items-center gap-3 text-sm">
              <span className="truncate">{t.topic}</span>
              <ProgressBar value={t.percentage} tone={t.percentage >= PASS_MARK ? "ok" : "bad"} />
              <span className="text-right tabular-nums text-muted">
                {t.correct}/{t.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold">Answer review</h2>
        <div className="space-y-3">
          {result.review.map((q, i) => {
            const showTopic = i === 0 || result.review[i - 1].topic !== q.topic;
            const correct = q.chosen === q.correct;
            return (
              <div key={q.id}>
                {showTopic && (
                  <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-muted first:mt-0">{q.topic}</h3>
                )}
                <article className="card p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className={cx(
                        "grid size-7 shrink-0 place-items-center rounded-full",
                        correct ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad",
                      )}
                      aria-label={correct ? "Correct" : "Incorrect"}
                    >
                      {correct ? <Check className="size-4" /> : <X className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <span className="mr-1.5 text-muted">{i + 1}.</span>
                        <RichText text={q.prompt} />
                      </p>
                      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                        {(["A", "B", "C", "D"] as Letter[]).map((k) => (
                          <li
                            key={k}
                            className={cx(
                              "rounded-lg border px-3 py-2",
                              k === q.correct && "border-ok/40 bg-ok-soft",
                              k === q.chosen && k !== q.correct && "border-bad/40 bg-bad-soft",
                              k !== q.correct && k !== q.chosen && "border-line",
                            )}
                          >
                            <span className="mr-2 font-semibold text-muted">{k.toLowerCase()}.</span>
                            <RichText text={q.choices[k]} />
                            {k === q.chosen && <span className="ml-2 text-xs font-semibold text-muted">(your answer)</span>}
                          </li>
                        ))}
                      </ul>
                      {q.passage && (
                        <details className="mt-3 rounded-lg border border-line px-3 py-2 text-sm">
                          <summary className="cursor-pointer font-medium text-muted">Show the passage</summary>
                          <p className="mt-2 whitespace-pre-line leading-relaxed">{q.passage}</p>
                        </details>
                      )}
                      <Feedback q={q} />
                    </div>
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ScoreRing({ percentage, passed }: { percentage: number; passed: boolean }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative mx-auto size-36">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-surface-2" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percentage / 100)}
          className={passed ? "stroke-ok" : "stroke-bad"}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-3xl font-semibold tabular-nums">{percentage}%</span>
      </div>
    </div>
  );
}

type ReviewItem = Awaited<ReturnType<typeof getResult>>["review"][number];

/** Verdict, explanation and tip shown under each reviewed question. */
function Feedback({ q }: { q: ReviewItem }) {
  const correctText = `(${q.correct.toLowerCase()}) ${q.choices[q.correct]}`;
  const chosenText = q.chosen ? `(${q.chosen.toLowerCase()}) ${q.choices[q.chosen]}` : "";
  const isCorrect = q.chosen === q.correct;
  return (
    <div className="mt-4 space-y-2.5 rounded-xl bg-surface-2 p-4 text-sm leading-relaxed">
      <p className={cx("font-semibold", isCorrect ? "text-ok" : "text-bad")}>
        {isCorrect ? (
          <>Correct. You chose <RichText text={chosenText} />.</>
        ) : q.chosen ? (
          <>
            Incorrect. You chose <RichText text={chosenText} />; the correct answer is <RichText text={correctText} />.
          </>
        ) : (
          <>Not answered. The correct answer is <RichText text={correctText} />.</>
        )}
      </p>
      {q.explanation && (
        <p>
          <span className="font-semibold">Why: </span>
          <RichText text={q.explanation} />
        </p>
      )}
      {q.tip && (
        <p>
          <span className="font-semibold">Tip: </span>
          <RichText text={q.tip} />
        </p>
      )}
      {q.source && <p className="text-xs text-muted">Source: {q.source}</p>}
    </div>
  );
}
