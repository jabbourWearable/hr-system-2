import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createCycle } from "../actions";
import { NewCycleForm } from "./new-cycle-form";

export default async function NewReviewCyclePage() {
  await requireRole("admin");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">New review cycle</h1>
          <p className="text-sm text-mute">
            e.g. &quot;Q1 2026 Performance Review&quot;.
          </p>
        </div>
        <Link href="/admin/reviews" className="text-sm font-medium text-link hover:underline">
          Back to reviews
        </Link>
      </div>
      <div className="card max-w-md p-6">
        <NewCycleForm action={createCycle} />
      </div>
    </main>
  );
}
