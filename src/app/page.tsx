import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Clock3 } from "lucide-react";
import { Logo } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { getBankStats, getBankTest } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session?.role === "candidate") redirect("/dashboard");

  const [stats, bank] = await Promise.all([getBankStats(), getBankTest()]);
  const topics = bank?.topics ?? [];

  const features = [
    {
      title: "Build your own practice",
      body: "Pick the topics, the number of questions and the time limit. A fresh set is drawn every time.",
    },
    {
      icon: Clock3,
      title: "Full timed mocks",
      body: "Sit complete UI Postgraduate EPT papers under real exam conditions.",
    },
    {
      title: `${stats.questions.toLocaleString()} questions`,
      body: `Covering ${stats.topics} topics from the UI Postgraduate English syllabus.`,
    },
    {
      icon: BarChart3,
      title: "See where you stand",
      body: "Instant scores, proficiency bands, a per-topic breakdown and a full answer review.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <Link href="/login" className="btn-ghost whitespace-nowrap px-3 sm:px-4">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary whitespace-nowrap px-3 sm:px-4">
            <span className="sm:hidden">Sign up</span>
            <span className="hidden sm:inline">Create account</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Walk into your English Proficiency Test <span className="text-brand">Ready.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted">
              {APP_NAME} gives you realistic computer-based mock exams, practice sets you design yourself and clear
              feedback, so you know exactly what to revise before exam day.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="btn-primary px-6 py-3 text-base">
                Create a free account               </Link>
              <Link href="/login" className="btn-secondary px-6 py-3 text-base">
                I already have an account
              </Link>
            </div>
          </div>

          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ title, body }) => (
              <div key={title} className="card p-6">
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {topics.length > 0 && (
          <section id="topics" className="border-t border-line bg-surface">
            <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand">
                {stats.questions.toLocaleString()} questions · {stats.topics} topics
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Everything the test covers</h2>
              <div className="mt-8 flex flex-wrap gap-2">
                {topics.map((topic, i) => (
                  <span key={topic} className="rounded-full border border-line bg-bg px-3.5 py-1.5 text-sm">
                    <span className="mr-1.5 tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
          © {new Date().getFullYear()} {APP_NAME} · {APP_TAGLINE}
        </div>
      </footer>
    </div>
  );
}
