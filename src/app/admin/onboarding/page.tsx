import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/onboarding/profiles";
import { computeProgress } from "@/lib/onboarding/progress";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import {
  WorkflowStatusBadge,
  WorkflowTypeBadge,
} from "@/components/onboarding/status-badge";
import type { OnboardingTaskStatus } from "@/types/database";

// Admin-only onboarding/offboarding overview (HR-77 — "Core hibob
// HR-lifecycle capability"). Gated by requireRole('admin') here — see
// ARCHITECTURE.md's note that every page under /admin must call this
// itself. onboarding_workflows_admin_all / onboarding_tasks_admin_all
// (0009_onboarding_offboarding.sql) grant the unrestricted read; this page
// doesn't otherwise narrow the query.
export default async function AdminOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("admin");
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("onboarding_workflows")
    .select("id, employee_id, workflow_type, status, target_date, created_at")
    .order("created_at", { ascending: false });

  if (status === "active" || status === "completed" || status === "cancelled") {
    query = query.eq("status", status);
  }

  const { data: workflows } = await query;

  const [profileMap, taskCounts] = await Promise.all([
    loadProfilesByIds(supabase, [...new Set((workflows ?? []).map((w) => w.employee_id))]),
    (async () => {
      const ids = (workflows ?? []).map((w) => w.id);
      if (ids.length === 0) return new Map<string, { status: OnboardingTaskStatus }[]>();
      const { data: tasks } = await supabase
        .from("onboarding_tasks")
        .select("workflow_id, status")
        .in("workflow_id", ids);
      const map = new Map<string, { status: OnboardingTaskStatus }[]>();
      for (const task of tasks ?? []) {
        const list = map.get(task.workflow_id) ?? [];
        list.push({ status: task.status });
        map.set(task.workflow_id, list);
      }
      return map;
    })(),
  ]);

  const filters = [
    { key: undefined, label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ] as const;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Onboarding &amp; offboarding</h1>
          <p className="text-sm text-mute">
            New-hire and departure checklists, with assignees and due dates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/onboarding/new" className="btn btn-primary">
            Start workflow
          </Link>
          <Link href="/admin" className="text-sm font-medium text-link hover:underline">
            Back to admin
          </Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.label}
            href={filter.key ? `/admin/onboarding?status=${filter.key}` : "/admin/onboarding"}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              status === filter.key || (!status && !filter.key)
                ? "border-hairline-strong bg-primary text-primary-on"
                : "border-hairline-strong bg-elevated text-body hover:text-ink"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {!workflows || workflows.length === 0 ? (
        <p className="text-sm text-mute">No workflows yet.</p>
      ) : (
        <ul className="space-y-3">
          {workflows.map((workflow) => {
            const progress = computeProgress(taskCounts.get(workflow.id) ?? []);
            return (
              <li key={workflow.id}>
                <Link
                  href={`/admin/onboarding/${workflow.id}`}
                  className="card flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:border-stone"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">
                        {profileMap.get(workflow.employee_id)?.fullName ?? "Unknown employee"}
                      </p>
                      <WorkflowTypeBadge type={workflow.workflow_type} />
                      <WorkflowStatusBadge status={workflow.status} />
                    </div>
                    <p className="font-mono text-[13px] text-mute">
                      {workflow.workflow_type === "onboarding" ? "Start date" : "Last day"}:{" "}
                      {workflow.target_date}
                    </p>
                  </div>
                  <ProgressBar
                    done={progress.done}
                    total={progress.total}
                    percent={progress.percent}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
