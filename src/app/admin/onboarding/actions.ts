"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, templateFor, type DefaultAssignee } from "@/lib/onboarding/templates";
import type { OnboardingTaskStatus, WorkflowStatus, WorkflowType } from "@/types/database";

export type ActionState = { error: string } | { message: string } | undefined;

function parseDate(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

function parseNullableId(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str || null;
}

// Admin/HR only (spec: "Structured new-hire onboarding and offboarding
// checklists... Core hibob HR-lifecycle capability", HR-77).
// onboarding_workflows_admin_all + onboarding_tasks_admin_all
// (0009_onboarding_offboarding.sql) are what actually authorize these writes
// against any employee's workflow, not just the admin's own.

export async function createWorkflow(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("admin");

  const employeeId = parseNullableId(formData.get("employeeId"));
  if (!employeeId) return { error: "Select an employee." };

  const workflowType = String(formData.get("workflowType") ?? "");
  if (workflowType !== "onboarding" && workflowType !== "offboarding") {
    return { error: "Invalid workflow type." };
  }

  const targetDate = parseDate(formData.get("targetDate"));
  if (!targetDate) return { error: "Pick a valid date." };

  const useTemplate = formData.get("useTemplate") === "on";

  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("profiles")
    .select("manager_id")
    .eq("id", employeeId)
    .single();

  const { data: workflow, error: workflowError } = await supabase
    .from("onboarding_workflows")
    .insert({
      employee_id: employeeId,
      workflow_type: workflowType as WorkflowType,
      target_date: targetDate,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (workflowError || !workflow) {
    return { error: workflowError?.message ?? "Could not create workflow." };
  }

  if (useTemplate) {
    const assigneeFor = (role: DefaultAssignee): string | null => {
      if (role === "employee") return employeeId;
      if (role === "manager") return employee?.manager_id ?? null;
      return admin.id;
    };

    const tasks = templateFor(workflowType as WorkflowType).map((item, index) => ({
      workflow_id: workflow.id,
      employee_id: employeeId,
      title: item.title,
      description: item.description,
      assignee_id: assigneeFor(item.defaultAssignee),
      due_date: addDaysISO(targetDate, item.dayOffset),
      order_index: index,
    }));

    const { error: tasksError } = await supabase.from("onboarding_tasks").insert(tasks);
    if (tasksError) {
      // The workflow itself was created successfully — surface the task-seed
      // failure but still send the admin to the (now task-less) workflow
      // rather than losing the redirect entirely; they can add tasks by hand.
      redirect(`/admin/onboarding/${workflow.id}?templateError=1`);
    }
  }

  revalidatePath("/admin/onboarding");
  redirect(`/admin/onboarding/${workflow.id}`);
}

export async function addTask(
  workflowId: string,
  employeeId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const assigneeId = parseNullableId(formData.get("assigneeId"));
  const dueDate = parseDate(formData.get("dueDate"));

  const supabase = await createClient();

  const { count } = await supabase
    .from("onboarding_tasks")
    .select("*", { count: "exact", head: true })
    .eq("workflow_id", workflowId);

  const { error } = await supabase.from("onboarding_tasks").insert({
    workflow_id: workflowId,
    employee_id: employeeId,
    title,
    description,
    assignee_id: assigneeId,
    due_date: dueDate,
    order_index: count ?? 0,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/onboarding/${workflowId}`);
  return { message: "Task added." };
}

export async function updateTask(
  workflowId: string,
  taskId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const assigneeId = parseNullableId(formData.get("assigneeId"));
  const dueDate = parseDate(formData.get("dueDate"));
  const status = String(formData.get("status") ?? "");
  const validStatuses: OnboardingTaskStatus[] = ["pending", "in_progress", "done"];
  if (!validStatuses.includes(status as OnboardingTaskStatus)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_tasks")
    .update({
      title,
      description,
      assignee_id: assigneeId,
      due_date: dueDate,
      status: status as OnboardingTaskStatus,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/onboarding/${workflowId}`);
  return { message: "Task updated." };
}

export async function deleteTask(workflowId: string, taskId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("onboarding_tasks").delete().eq("id", taskId);
  revalidatePath(`/admin/onboarding/${workflowId}`);
}

export async function setWorkflowStatus(
  workflowId: string,
  status: WorkflowStatus,
): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("onboarding_workflows")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", workflowId);

  revalidatePath(`/admin/onboarding/${workflowId}`);
  revalidatePath("/admin/onboarding");
}
