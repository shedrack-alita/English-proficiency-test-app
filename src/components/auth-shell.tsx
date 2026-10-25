import type { ReactNode } from "react";
import { connection } from "next/server";
import { Logo } from "@/components/ui";
import { APP_TAGLINE } from "@/lib/constants";
import { getBankStats } from "@/lib/data";

/** Two-column layout shared by the candidate sign-in and sign-up pages. */
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  // Render per request so the counts come from the live database, not from build time.
  await connection();
  const stats = await getBankStats();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-muted">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand lg:block">
        {/* Computer-based test centre photo under a plain brand-blue tint (falls back to plain blue). */}
        <div className="absolute inset-0 bg-[url('/images/cbt-centre.jpg')] bg-cover bg-center" aria-hidden />
        <div className="absolute inset-0 bg-[#1d1f7a]/75" aria-hidden />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="text-sm font-medium uppercase tracking-widest text-white/70">{APP_TAGLINE}</p>
          <blockquote className="mt-4 max-w-md text-3xl font-semibold leading-snug">
            Build a practice set on any topic, then sit a full timed mock when you&apos;re ready.
          </blockquote>
          <div className="mt-8 grid max-w-xs grid-cols-2 gap-4 text-sm">
            {[
              [stats.questions.toLocaleString(), "questions"],
              [String(stats.topics), "topics"],
            ].map(([n, label]) => (
              <div key={label} className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="text-2xl font-semibold">{n}</div>
                <div className="text-white/75">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
