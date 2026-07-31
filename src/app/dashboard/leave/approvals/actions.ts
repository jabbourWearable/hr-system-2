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

// Manager-only review action (spec §5 item 7: "manager sees pending requests
// from direct reports and approves/rejects"). requireRole('manager') gates
// entry here in addition to the page-level guard on
// /dashboard/leave/approvals — see ARCHITECTURE.md on guarding actions, not
// just pages. Which rows a manager may actually update is enforced by RLS
// (leave_requests_update_manager, 0002_rls_policies.sql), not by this code.
export async function reviewAsManager(
  requestId: string,
  _prevState: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireRole("manager");

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

  if (result && "message" in result) revalidatePath("/dashboard/leave/approvals");
  return result;
}
