import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { getSession } from "@/lib/session";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in" };

export default async function AdminLoginPage() {
  if (await getSession("admin")) redirect("/admin");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="card p-7">
          <div className="mb-6 flex items-center gap-3">
            <div>
              <h1 className="font-semibold">Admin sign in</h1>
              <p className="text-sm text-muted">Manage tests, candidates and results.</p>
            </div>
          </div>
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
