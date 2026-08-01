"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string } | { message: string } | undefined;

// Employee submits (and locks) their own self-assessment. The
// `.eq("employee_id", user.id).eq("status", "pending_self")` guard is
// defense-in-depth on top of performance_reviews_update_own
// (0010_performance_reviews_goals.sql), which is what actually authorizes
// the row — same "belt and suspenders" shape as applyLeaveDecision's
// `.eq("status", "pending")` guard (src/lib/leave/review.ts). Submitting
// moves the review to pending_manager so the reviewer's section unlocks.
export async function submitSelfAssessment(
  reviewId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const selfAssessment = String(formData.get("selfAssessment") ?? "").trim();
  if (!selfAssessment) return { error: "Self-assessment can't be empty." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_reviews")
    .update({
      self_assessment: selfAssessment,
      self_submitted_at: new Date().toISOString(),
      status: "pending_manager",
    })
    .eq("id", reviewId)
    .eq("employee_id", user.id)
    .eq("status", "pending_self")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "This review isn't awaiting your self-assessment." };

  revalidatePath(`/dashboard/reviews/${reviewId}`);
  revalidatePath("/dashboard/reviews");
  return { message: "Self-assessment submitted." };
}

// Reviewer (the review's reviewer_id, typically the employee's manager)
// submits the manager assessment + 1-5 rating, completing the review.
export async function submitManagerAssessment(
  reviewId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const managerAssessment = String(formData.get("managerAssessment") ?? "").trim();
  if (!managerAssessment) return { error: "Manager assessment can't be empty." };

  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Pick a rating from 1 to 5." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_reviews")
    .update({
      manager_assessment: managerAssessment,
      rating,
      manager_submitted_at: new Date().toISOString(),
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("reviewer_id", user.id)
    .eq("status", "pending_manager")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "This review isn't awaiting your assessment." };

  revalidatePath(`/dashboard/reviews/${reviewId}`);
  revalidatePath("/dashboard/reviews");
  return { message: "Review completed." };
}
