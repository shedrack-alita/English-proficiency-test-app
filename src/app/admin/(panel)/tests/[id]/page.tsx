import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Pencil, Search, Trash2, Trophy } from "lucide-react";
import { Badge, PageHeader, RichText, cx } from "@/components/ui";
import { KIND_LABEL } from "@/lib/constants";
import { QUESTIONS_PER_PAGE, getAttemptCounts, getTopics, listQuestions } from "@/lib/admin-data";
import { getAllTests, getTest } from "@/lib/data";
import { removeQuestion, removeTest } from "@/app/admin/actions";
import { ConfirmButton, CsvImportForm, QuestionForm, TestForm } from "../../forms";

export async function generateMetadata({ params }: PageProps<"/admin/tests/[id]">) {
  const test = await getTest(Number((await params).id));
  return { title: test ? `Manage: ${test.title}` : "Test" };
}

export default async function AdminTestPage({ params, searchParams }: PageProps<"/admin/tests/[id]">) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const topic = typeof sp.topic === "string" ? sp.topic : "";
  const search = typeof sp.q === "string" ? sp.q : "";
  const requestedPage = Number(sp.page) || 1;
  const test = await getTest(id);
  if (!test) notFound();

  const [questions, topics, allTests, attempts] = await Promise.all([
    listQuestions(id, { topic, search, page: requestedPage }),
    getTopics(),
    getAllTests(),
    getAttemptCounts(),
  ]);
  const categories = [...new Set(allTests.map((t) => t.category).filter(Boolean))];

  const questionCount = questions.topics.reduce((n, t) => n + t.count, 0);
  const filtered = Boolean(topic || search);
  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    if (topic) qs.set("topic", topic);
    if (search) qs.set("q", search);
    if (page > 1) qs.set("page", String(page));
    const str = qs.toString();
    return `/admin/tests/${id}${str ? `?${str}` : ""}#questions`;
  };

  return (
    <>
      <Link href="/admin/tests" className="btn-ghost -ml-3 mb-4 px-3">
        <ArrowLeft className="size-4" aria-hidden /> All tests
      </Link>
      <PageHeader
        title={test.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={test.kind === "official" ? "brand" : "neutral"}>{KIND_LABEL[test.kind]}</Badge>
            {questionCount} question{questionCount === 1 ? "" : "s"} · {attempts.get(id) ?? 0} submitted attempt
            {(attempts.get(id) ?? 0) === 1 ? "" : "s"}
          </span>
        }
        actions={
          <Link href={`/admin/results?test=${id}`} className="btn-secondary">
            <Trophy className="size-4" aria-hidden /> Ranking
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-5 font-semibold">Details</h2>
          <TestForm
            categories={categories}
            initial={{
              id: test.id,
              title: test.title,
              category: test.category,
              description: test.description,
              kind: test.kind,
              timeLimit: test.timeLimit,
              questionLimit: test.questionLimit,
              shuffle: test.shuffle,
            }}
          />
          <form action={removeTest} className="mt-6 border-t border-line pt-5">
            <input type="hidden" name="id" value={test.id} />
            <ConfirmButton message={`Delete "${test.title}" with all its questions and every candidate's attempts? This can't be undone.`}>
              <Trash2 className="size-4" aria-hidden /> Delete test
            </ConfirmButton>
          </form>
        </section>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-5 font-semibold">Add a question</h2>
            <QuestionForm testId={test.id} topics={topics} defaultTopic={test.topics.length === 1 ? test.topics[0] : ""} />
          </section>
          <section className="card p-6">
            <h2 className="mb-5 font-semibold">Import from CSV</h2>
            <CsvImportForm testId={test.id} topics={topics} />
          </section>
        </div>
      </div>

      <section id="questions" className="mt-8 scroll-mt-24">
        <h2 className="mb-4 text-lg font-semibold">Questions</h2>
        <form className="mb-4 flex flex-wrap gap-2" role="search" action={`/admin/tests/${id}#questions`}>
          <select name="topic" defaultValue={topic} aria-label="Filter by topic" className="input w-auto">
            <option value="">All topics ({questionCount})</option>
            {questions.topics.map((t) => (
              <option key={t.topic} value={t.topic}>
                {t.topic || "No topic"} ({t.count})
              </option>
            ))}
          </select>
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={search} placeholder="Search question text, options or source" aria-label="Search questions" className="input pl-9" />
          </div>
          <button type="submit" className="btn-secondary">
            Filter
          </button>
          {filtered && (
            <Link href={`/admin/tests/${id}#questions`} className="btn-ghost">
              Clear
            </Link>
          )}
        </form>
        <p className="mb-3 text-sm text-muted">
          {questions.total === 0
            ? filtered
              ? "No questions match these filters."
              : "No questions yet. Add one above or import a CSV."
            : `Showing ${(questions.page - 1) * QUESTIONS_PER_PAGE + 1}–${(questions.page - 1) * QUESTIONS_PER_PAGE + questions.items.length} of ${questions.total}${filtered ? " matching" : ""}`}
        </p>
        <ul className="space-y-2">
          {questions.items.map((q) => (
            <li key={q.id} id={`q-${q.id}`} className="card scroll-mt-24 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 w-12 shrink-0 text-sm font-semibold tabular-nums text-muted">Q{q.position}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <RichText text={q.prompt || q.instruction} />
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <Badge>{q.topic || "No topic"}</Badge>
                    {q.passage && (
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="size-3.5" aria-hidden /> Has a passage
                      </span>
                    )}
                    {q.source && <span className="truncate">{q.source}</span>}
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    {(["A", "B", "C", "D"] as const).map((k) => (
                      <li key={k} className={cx("rounded-lg px-2 py-1", q.answer === k ? "bg-ok-soft font-medium text-ok" : "text-muted")}>
                        {k.toLowerCase()}. <RichText text={q.choices[k]} />
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Link href={`/admin/tests/${test.id}/questions/${q.id}`} className="btn-ghost px-2.5" aria-label={`Edit question ${q.position}`}>
                    <Pencil className="size-4" />
                  </Link>
                  <form action={removeQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="testId" value={test.id} />
                    <ConfirmButton
                      message="Delete this question? Past results that included it will no longer show it in the review."
                      className="btn-ghost px-2.5 text-bad hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 className="size-4" aria-label={`Delete question ${q.position}`} />
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {questions.pages > 1 && (
          <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Question pages">
            {questions.page > 1 ? (
              <Link href={pageHref(questions.page - 1)} className="btn-secondary">
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm tabular-nums text-muted">
              Page {questions.page} of {questions.pages}
            </span>
            {questions.page < questions.pages ? (
              <Link href={pageHref(questions.page + 1)} className="btn-secondary">
                Next <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </>
  );
}
