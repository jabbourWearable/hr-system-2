"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingTaskStatus } from "@/types/database";

export type TaskActionState = { error: string } | { message: string } | undefined;

// Any employee/manager can update the status of a task assigned to them
// (mark it in-progress/done), whether it's on their own onboarding/
// offboarding checklist or one they were assigned as a helper (e.g. a
// manager's "Welcome meeting" task on a direct report's workflow). The
// `.eq("assignee_id", user.id)` guard below is defense-in-depth on top of
// onboarding_tasks_update_assignee (0009_onboarding_offboarding.sql), which
// is what actually authorizes the row — same "belt and suspenders" shape as
// applyLeaveDecision's `.eq("status", "pending")` guard (src/lib/leave/review.ts).
export async function updateMyTaskStatus(
  taskId: string,
  _prevState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const user = await requireUser();

  const status = String(formData.get("status") ?? "");
  const validStatuses: OnboardingTaskStatus[] = ["pending", "in_progress", "done"];
  if (!validStatuses.includes(status as OnboardingTaskStatus)) {
    return { error: "Invalid status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_tasks")
    .update({
      status: status as OnboardingTaskStatus,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId)
    .eq("assignee_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "This task isn't assigned to you." };

  revalidatePath("/dashboard/onboarding");
  revalidatePath("/dashboard/onboarding/team");
  return { message: "Task updated." };
}
