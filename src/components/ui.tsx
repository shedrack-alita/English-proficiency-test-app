import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpenCheck } from "lucide-react";
import { APP_NAME, type Tone } from "@/lib/constants";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm">
        <BookOpenCheck className="size-5" aria-hidden />
      </span>
      {!compact && <span className="text-lg">{APP_NAME}</span>}
    </Link>
  );
}

/** Renders `**text**` (underlined words in the printed paper) as bold, underlined text. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold underline decoration-brand decoration-2 underline-offset-4">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </span>
  );
}

const toneClasses: Record<Tone | "neutral" | "brand", string> = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand-strong",
  green: "bg-ok-soft text-ok",
  red: "bg-bad-soft text-bad",
  amber: "bg-warn-soft text-warn",
  blue: "bg-brand-soft text-brand-strong",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof toneClasses; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClasses[tone])}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        {icon && <span className="text-brand">{icon}</span>}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "ok" | "bad" | "warn" }) {
  const fill = { brand: "bg-brand", ok: "bg-ok", bad: "bg-bad", warn: "bg-accent" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={cx("h-full rounded-full transition-all", fill)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    info: "border-brand/20 bg-brand-soft text-brand-strong",
    error: "border-bad/20 bg-bad-soft text-bad",
    success: "border-ok/20 bg-ok-soft text-ok",
    warning: "border-warn/20 bg-warn-soft text-warn",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", styles)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function formatDate(ms: number) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(ms);
}
