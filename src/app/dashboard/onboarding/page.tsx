import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/onboarding/profiles";
import { computeProgress } from "@/lib/onboarding/progress";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import {
  TaskStatusBadge,
  WorkflowStatusBadge,
  WorkflowTypeBadge,
} from "@/components/onboarding/status-badge";
import { TaskStatusForm } from "./task-status-form";

// Employee-facing onboarding/offboarding view (HR-77). Two independent
// sections: the current user's own checklist (their onboarding or
// offboarding workflow, if one exists) and any tasks assigned to them on
// someone else's workflow (e.g. a manager's "Welcome meeting" task on a
// direct report's onboarding). RLS (onboarding_workflows_select_own /
// onboarding_tasks_select_own, 0009_onboarding_offboarding.sql) already
// scopes both queries — the explicit .eq()/.neq() filters below just make
// the intent readable, same convention as every other /dashboard page.
export default async function DashboardOnboardingPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: myWorkflows }, { data: assignedTasks }] = await Promise.all([
    supabase
      .from("onboarding_workflows")
      .select("id, workflow_type, status, target_date")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("onboarding_tasks")
      .select("id, workflow_id, employee_id, title, description, due_date, status")
      .eq("assignee_id", user.id)
      .neq("employee_id", user.id)
      .order("due_date", { ascending: true }),
  ]);

  const workflowIds = (myWorkflows ?? []).map((w) => w.id);
  const { data: myTasks } = workflowIds.length
    ? await supabase
        .from("onboarding_tasks")
        .select("id, workflow_id, title, description, assignee_id, due_date, status")
        .in("workflow_id", workflowIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  const tasksByWorkflow = new Map<string, typeof myTasks>();
  for (const task of myTasks ?? []) {
    const list = tasksByWorkflow.get(task.workflow_id) ?? [];
    list.push(task);
    tasksByWorkflow.set(task.workflow_id, list);
  }

  const otherEmployeeIds = [...new Set((assignedTasks ?? []).map((t) => t.employee_id))];
  const employeeNames = await loadProfilesByIds(supabase, otherEmployeeIds);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Onboarding &amp; offboarding</h1>
          <p className="text-sm text-mute">Your checklist and any tasks assigned to you.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Back to dashboard
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Your checklist</h2>
        {!myWorkflows || myWorkflows.length === 0 ? (
          <p className="text-sm text-mute">No onboarding or offboarding workflow yet.</p>
        ) : (
          <div className="space-y-6">
            {myWorkflows.map((workflow) => {
              const tasks = tasksByWorkflow.get(workflow.id) ?? [];
              const progress = computeProgress(tasks);
              return (
                <div key={workflow.id} className="card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline p-5">
                    <div className="flex items-center gap-2">
                      <WorkflowTypeBadge type={workflow.workflow_type} />
                      <WorkflowStatusBadge status={workflow.status} />
                      <span className="font-mono text-[13px] text-mute">
                        {workflow.workflow_type === "onboarding" ? "Start" : "Last day"}:{" "}
                        {workflow.target_date}
                      </span>
                    </div>
                    <ProgressBar
                      done={progress.done}
                      total={progress.total}
                      percent={progress.percent}
                    />
                  </div>
                  {tasks.length === 0 ? (
                    <p className="p-5 text-sm text-mute">No tasks yet.</p>
                  ) : (
                    <ul className="divide-y divide-hairline">
                      {tasks.map((task) => (
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
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Tasks assigned to you</h2>
        {!assignedTasks || assignedTasks.length === 0 ? (
          <p className="text-sm text-mute">
            Nothing assigned to you on anyone else&apos;s checklist right now.
          </p>
        ) : (
          <ul className="card divide-y divide-hairline">
            {assignedTasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-ink">{task.title}</p>
                  <p className="text-sm text-mute">
                    {employeeNames.get(task.employee_id)?.fullName ?? "Unknown employee"}
                    {task.due_date && (
                      <span className="font-mono text-[12px]"> · Due {task.due_date}</span>
                    )}
                  </p>
                </div>
                <TaskStatusForm taskId={task.id} status={task.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
