import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getAllTests } from "@/lib/data";
import { TestForm } from "../../forms";

export const metadata = { title: "New test" };

export default async function NewTestPage() {
  const categories = [...new Set((await getAllTests()).map((t) => t.category).filter(Boolean))];
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/tests" className="btn-ghost -ml-3 mb-4 px-3">
        <ArrowLeft className="size-4" aria-hidden /> All tests
      </Link>
      <PageHeader title="New test" subtitle="Set up the test, then add questions or import them from CSV." />
      <div className="card p-6 sm:p-8">
        <TestForm
          categories={categories}
          initial={{ title: "", category: "", description: "", kind: "practice", timeLimit: 0, questionLimit: 0, shuffle: true }}
        />
      </div>
    </div>
  );
}
