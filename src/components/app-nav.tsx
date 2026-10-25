"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  ClipboardList,
  History,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  NotebookPen,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Logo, cx } from "@/components/ui";

const NAV = {
  candidate: {
    home: "/dashboard",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/tests", label: "Tests & practice", icon: NotebookPen },
      { href: "/dashboard/results", label: "My results", icon: History },
      { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquareText },
    ],
  },
  admin: {
    home: "/admin",
    links: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/tests", label: "Tests & questions", icon: ClipboardList },
      { href: "/admin/candidates", label: "Candidates", icon: Users },
      { href: "/admin/results", label: "Results & rankings", icon: BarChart3 },
      { href: "/admin/feedback", label: "Feedback", icon: MessageSquareText },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
};

export type NavVariant = keyof typeof NAV;

function NavLinks({ variant, onNavigate }: { variant: NavVariant; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { home, links } = NAV[variant];
  return (
    <nav className="mt-6 space-y-1" aria-label="Main">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === home ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarNav({ variant }: { variant: NavVariant }) {
  return <NavLinks variant={variant} />;
}

export function MobileNav({ variant, userCard, signOut }: { variant: NavVariant; userCard: ReactNode; signOut: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Logo href={NAV[variant].home} />
        <button
          type="button"
          className="btn-ghost px-2.5"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line px-4 pb-4">
          <NavLinks variant={variant} onNavigate={() => setOpen(false)} />
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            {userCard}
            {signOut}
          </div>
        </div>
      )}
    </div>
  );
}
