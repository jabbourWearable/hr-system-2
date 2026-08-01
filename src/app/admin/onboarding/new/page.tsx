import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createWorkflow } from "../actions";
import { NewWorkflowForm } from "./new-workflow-form";

export default async function NewOnboardingWorkflowPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Start a workflow</h1>
          <p className="text-sm text-mute">
            Create an onboarding or offboarding checklist for an employee.
          </p>
        </div>
        <Link
          href="/admin/onboarding"
          className="text-sm font-medium text-link hover:underline"
        >
          Back to onboarding
        </Link>
      </div>
      <div className="card max-w-md p-6">
        <NewWorkflowForm
          action={createWorkflow}
          employees={(employees ?? []).map((e) => ({ id: e.id, fullName: e.full_name }))}
        />
      </div>
    </main>
  );
}
