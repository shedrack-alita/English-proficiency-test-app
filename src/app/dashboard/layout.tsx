import { AppShell } from "@/components/app-shell";
import { logout } from "@/app/actions";
import { requireCandidate } from "@/lib/session";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const candidate = await requireCandidate();
  return (
    <AppShell variant="candidate" name={candidate.fullName} detail={candidate.email} logout={logout}>
      {children}
    </AppShell>
  );
}
