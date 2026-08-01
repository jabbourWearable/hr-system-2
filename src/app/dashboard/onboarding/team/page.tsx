import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { computeProgress } from "@/lib/onboarding/progress";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import {
  TaskStatusBadge,
  WorkflowStatusBadge,
  WorkflowTypeBadge,
} from "@/components/onboarding/status-badge";
import { TaskStatusForm } from "../task-status-form";

// Manager-only view of direct reports' onboarding/offboarding workflows
// (HR-77, spec: "progress tracking"). RLS (onboarding_workflows_select_manager
// / onboarding_tasks_select_manager, 0009_onboarding_offboarding.sql) already
// scopes both queries to this manager's own direct reports — the
// `.in("employee_id", reportIds)` filter below just narrows the same set
// explicitly. The company-wide equivalent lives at /admin/onboarding (its
// own requireRole('admin') page).
export default async function TeamOnboardingPage() {
  const user = await requireRole("manager");
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("manager_id", user.id)
    .order("full_name");

  const reportIds = (reports ?? []).map((r) => r.id);
  const nameById = new Map((reports ?? []).map((r) => [r.id, r.full_name]));

  const { data: workflows } = reportIds.length
    ? await supabase
        .from("onboarding_workflows")
        .select("id, employee_id, workflow_type, status, target_date")
        .in("employee_id", reportIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const workflowIds = (workflows ?? []).map((w) => w.id);
  const { data: tasks } = workflowIds.length
    ? await supabase
        .from("onboarding_tasks")
        .select("id, workflow_id, title, description, assignee_id, due_date, status")
        .in("workflow_id", workflowIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  const tasksByWorkflow = new Map<string, typeof tasks>();
  for (const task of tasks ?? []) {
    const list = tasksByWorkflow.get(task.workflow_id) ?? [];
    list.push(task);
    tasksByWorkflow.set(task.workflow_id, list);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Team onboarding &amp; offboarding</h1>
          <p className="text-sm text-mute">Checklists for your direct reports.</p>
        </div>
        <Link
          href="/dashboard/onboarding"
          className="text-sm font-medium text-link hover:underline"
        >
          Back to your checklist
        </Link>
      </div>

      {!workflows || workflows.length === 0 ? (
        <p className="text-sm text-mute">No workflows for your direct reports yet.</p>
      ) : (
        <div className="space-y-6">
          {workflows.map((workflow) => {
            const workflowTasks = tasksByWorkflow.get(workflow.id) ?? [];
            const progress = computeProgress(workflowTasks);
            return (
              <div key={workflow.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-5">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink">
                      {nameById.get(workflow.employee_id) ?? "Unknown employee"}
                    </p>
                    <WorkflowTypeBadge type={workflow.workflow_type} />
                    <WorkflowStatusBadge status={workflow.status} />
                  </div>
                  <ProgressBar
                    done={progress.done}
                    total={progress.total}
                    percent={progress.percent}
                  />
                </div>
                {workflowTasks.length === 0 ? (
                  <p className="p-5 text-sm text-mute">No tasks yet.</p>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {workflowTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-medium text-ink">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-mute">{task.description}</p>
                          )}
                          {task.due_date && (
                            <p className="font-mono text-[12px] text-mute">
                              Due {task.due_date}
                            </p>
                          )}
                        </div>
                        {task.assignee_id === user.id ? (
                          <TaskStatusForm taskId={task.id} status={task.status} />
                        ) : (
                          <TaskStatusBadge status={task.status} />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
