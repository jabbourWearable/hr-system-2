"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  applyLeaveDecision,
  parseReviewComment,
  parseReviewDecision,
  type ReviewActionState,
} from "@/lib/leave/review";

// Admin can approve/reject any leave request, not just direct reports
// (spec §5 item 7 / §4 Admin). requireRole('admin') gates entry here in
// addition to the page-level guard on /admin/leave. leave_requests_admin_all
// (0002_rls_policies.sql) is what actually allows the update to reach any
// row, regardless of manager_id.
export async function reviewAsAdmin(
  requestId: string,
  _prevState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireRole("admin");

  const decision = parseReviewDecision(formData);
  if (!decision) return { error: "Invalid decision." };

  const supabase = await createClient();
  const result = await applyLeaveDecision(
    supabase,
    user.id,
    requestId,
    decision,
    parseReviewComment(formData),
  );

  if (result && "message" in result) revalidatePath("/admin/leave");
  return result;
}
