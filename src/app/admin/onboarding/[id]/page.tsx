import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/onboarding/profiles";
import { computeProgress } from "@/lib/onboarding/progress";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import {
  WorkflowStatusBadge,
  WorkflowTypeBadge,
} from "@/components/onboarding/status-badge";
import { addTask, deleteTask, setWorkflowStatus, updateTask } from "../actions";
import { TaskRowForm } from "./task-row-form";
import { AddTaskForm } from "./add-task-form";

export default async function AdminOnboardingWorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ templateError?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { templateError } = await searchParams;
  const supabase = await createClient();

  const { data: workflow } = await supabase
    .from("onboarding_workflows")
    .select("id, employee_id, workflow_type, status, target_date, created_by, created_at")
    .eq("id", id)
    .single();

  if (!workflow) notFound();

  const [{ data: tasks }, { data: allProfiles }] = await Promise.all([
    supabase
      .from("onboarding_tasks")
      .select("id, title, description, assignee_id, due_date, status, order_index")
      .eq("workflow_id", id)
      .order("order_index", { ascending: true }),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  const profileMap = await loadProfilesByIds(supabase, [workflow.employee_id]);
  const assignees = (allProfiles ?? []).map((p) => ({ id: p.id, fullName: p.full_name }));
  const progress = computeProgress(tasks ?? []);

  const updateTaskWithIds = (taskId: string) => updateTask.bind(null, workflow.id, taskId);
  const deleteTaskWithIds = (taskId: string) => deleteTask.bind(null, workflow.id, taskId);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display-serif text-3xl">
              {profileMap.get(workflow.employee_id)?.fullName ?? "Unknown employee"}
            </h1>
            <WorkflowTypeBadge type={workflow.workflow_type} />
            <WorkflowStatusBadge status={workflow.status} />
          </div>
          <p className="text-sm text-mute">
            {workflow.workflow_type === "onboarding" ? "Start date" : "Last working day"}:{" "}
            <span className="font-mono text-[13px]">{workflow.target_date}</span>
          </p>
          <ProgressBar done={progress.done} total={progress.total} percent={progress.percent} />
          {templateError && (
            <p role="alert" className="text-sm text-accent-red">
              The workflow was created, but seeding the standard checklist failed. Add
              tasks manually below.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          <Link
            href="/admin/onboarding"
            className="text-sm font-medium text-link hover:underline"
          >
            Back to onboarding
          </Link>
          <div className="flex gap-2">
            {workflow.status !== "completed" && (
              <form action={setWorkflowStatus.bind(null, workflow.id, "completed")}>
                <button type="submit" className="btn btn-outline btn-sm">
                  Mark completed
                </button>
              </form>
            )}
            {workflow.status !== "cancelled" && (
              <form action={setWorkflowStatus.bind(null, workflow.id, "cancelled")}>
                <button type="submit" className="btn btn-danger btn-sm">
                  Cancel
                </button>
              </form>
            )}
            {workflow.status !== "active" && (
              <form action={setWorkflowStatus.bind(null, workflow.id, "active")}>
                <button type="submit" className="btn btn-outline btn-sm">
                  Reactivate
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Tasks</h2>
        {!tasks || tasks.length === 0 ? (
          <p className="text-sm text-mute">No tasks yet — add one below.</p>
        ) : (
          <div className="card divide-y divide-hairline">
            {tasks.map((task) => (
              <TaskRowForm
                key={task.id}
                task={task}
                assignees={assignees}
                action={updateTaskWithIds(task.id)}
                onDelete={deleteTaskWithIds(task.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Add a task</h2>
        <div className="card">
          <AddTaskForm
            action={addTask.bind(null, workflow.id, workflow.employee_id)}
            assignees={assignees}
          />
        </div>
      </section>
    </main>
  );
}
