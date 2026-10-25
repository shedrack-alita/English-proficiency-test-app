import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { PasswordForm } from "../forms";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Settings" subtitle={`Signed in as ${admin.username}.`} />
      <section className="card p-6">
        <h2 className="mb-5 font-semibold">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
