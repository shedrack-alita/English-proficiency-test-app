import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui";
import { adminLogout } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AppShell variant="admin" name={admin.username} detail="Administrator" badge={<Badge tone="brand">Admin</Badge>} logout={adminLogout}>
      {children}
    </AppShell>
  );
}
