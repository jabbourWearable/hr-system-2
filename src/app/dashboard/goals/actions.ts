"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { GoalStatus, GoalType } from "@/types/database";

export type ActionState = { error: string } | { message: string } | undefined;

function parseDate(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

function parseNullableId(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str || null;
}

// Every write here is scoped to the caller's own goals — goals_insert_own/
// _update_own/_delete_own (0010_performance_reviews_goals.sql) are what
// actually authorize it; the explicit `.eq("employee_id", user.id")` guards
// below are defense-in-depth, same "belt and suspenders" shape used
// throughout this app (see src/lib/leave/review.ts).
export async function createGoal(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const goalType = String(formData.get("goalType") ?? "goal");
  const validTypes: GoalType[] = ["objective", "key_result", "goal"];
  if (!validTypes.includes(goalType as GoalType)) return { error: "Invalid goal type." };

  const parentGoalId = goalType === "key_result" ? parseNullableId(formData.get("parentGoalId")) : null;
  if (goalType === "key_result" && !parentGoalId) {
    return { error: "A key result needs a parent objective." };
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  const dueDate = parseDate(formData.get("dueDate"));

  const supabase = await createClient();
  const { error } = await supabase.from("goals").insert({
    employee_id: user.id,
    goal_type: goalType as GoalType,
    parent_goal_id: parentGoalId,
    title,
    description,
    due_date: dueDate,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/goals");
  return { message: "Goal added." };
}

export async function updateGoal(
  goalId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const dueDate = parseDate(formData.get("dueDate"));
  const status = String(formData.get("status") ?? "");
  const validStatuses: GoalStatus[] = ["not_started", "on_track", "at_risk", "completed"];
  if (!validStatuses.includes(status as GoalStatus)) return { error: "Invalid status." };

  const progress = Number(formData.get("progress"));
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    return { error: "Progress must be between 0 and 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ title, description, due_date: dueDate, status: status as GoalStatus, progress })
    .eq("id", goalId)
    .eq("employee_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/goals");
  return { message: "Goal updated." };
}

export async function deleteGoal(goalId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("goals").delete().eq("id", goalId).eq("employee_id", user.id);
  revalidatePath("/dashboard/goals");
}
