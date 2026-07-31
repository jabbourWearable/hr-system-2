import "server-only";
import type { createClient } from "@/lib/supabase/server";

export type ReviewDecision = "approved" | "rejected";
export type ReviewActionState = { error: string } | { message: string } | undefined;

export function parseReviewDecision(formData: FormData): ReviewDecision | null {
  const decision = formData.get("decision");
  return decision === "approved" || decision === "rejected" ? decision : null;
}

export function parseReviewComment(formData: FormData): string | null {
  const comment = String(formData.get("comment") ?? "").trim();
  return comment || null;
}

// Shared by the manager (src/app/dashboard/leave/approvals/actions.ts) and
// admin (src/app/admin/leave/actions.ts) review Server Actions. The
// `status = 'pending'` guard stops a stale page re-submitting a decision on
// an already-reviewed request; `.select().maybeSingle()` distinguishes "no
// matching row" (unauthorized, or already reviewed — RLS returns zero rows
// silently rather than an error) from a real database error.
export async function applyLeaveDecision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reviewerId: string,
  requestId: string,
  decision: ReviewDecision,
  comment: string | null,
): Promise<ReviewActionState> {
  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_comment: comment,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error: "This request is no longer pending, or you're not authorized to review it.",
    };
  }

  return {
    message: decision === "approved" ? "Leave request approved." : "Leave request rejected.",
  };
}
