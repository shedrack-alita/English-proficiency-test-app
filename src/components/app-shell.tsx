import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { MobileNav, SidebarNav, type NavVariant } from "@/components/app-nav";

/** Sidebar layout shared by the candidate dashboard and the admin panel. */
export function AppShell({
  variant,
  name,
  detail,
  badge,
  logout,
  children,
}: {
  variant: NavVariant;
  name: string;
  detail: string;
  badge?: ReactNode;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const home = variant === "admin" ? "/admin" : "/dashboard";

  const userCard = (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">
        {initials}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted">{detail}</div>
      </div>
    </div>
  );

  const signOut = (
    <form action={logout}>
      <button type="submit" className="btn-ghost w-full justify-start px-3">
        Sign out
      </button>
    </form>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <Logo href={home} />
          {badge}
        </div>
        <SidebarNav variant={variant} />
        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <div className="px-2">{userCard}</div>
          {signOut}
        </div>
      </aside>

      <MobileNav variant={variant} userCard={userCard} signOut={signOut} />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
