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
// an already-reviewed request (and doubles as the "no notification for a
// pending→pending no-op" rule, HR-14 task 17 — this function only ever runs
// when the status is actually changing); `.select().maybeSingle()`
// distinguishes "no matching row" (unauthorized, or already reviewed — RLS
// returns zero rows silently rather than an error) from a real database
// error.
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
    .select("id, user_id, start_date, end_date")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error: "This request is no longer pending, or you're not authorized to review it.",
    };
  }

  // Best-effort: the leave request's own status change has already
  // committed above, so a notification failure (e.g. notifications_insert_
  // reviewer, 0006_notifications_insert_reviewer.sql, not yet applied)
  // shouldn't turn a successful review into an error response — it would
  // just mean the requester doesn't get an in-app notification this time.
  await supabase.from("notifications").insert({
    user_id: data.user_id,
    message: `Your leave request for ${data.start_date}–${data.end_date} was ${decision}.`,
  });

  return {
    message: decision === "approved" ? "Leave request approved." : "Leave request rejected.",
  };
}
