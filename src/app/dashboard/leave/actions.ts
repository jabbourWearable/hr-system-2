"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type LeaveRequestFormState = { error: string } | undefined;

// Not exported — a "use server" file may only export async functions.
const LEAVE_TYPES = ["vacation", "sick", "personal", "unpaid", "other"] as const;

type ParsedLeaveRequest = {
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
};

function parseLeaveForm(formData: FormData): ParsedLeaveRequest {
  return {
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    leaveType: String(formData.get("leaveType") ?? ""),
    reason: String(formData.get("reason") ?? "").trim(),
  };
}

function validateLeaveForm(parsed: ParsedLeaveRequest): string | null {
  if (!parsed.startDate || !parsed.endDate) {
    return "Start and end date are required.";
  }
  if (Number.isNaN(Date.parse(parsed.startDate)) || Number.isNaN(Date.parse(parsed.endDate))) {
    return "Start and end date must be valid dates.";
  }
  // ISO date strings (YYYY-MM-DD) compare correctly as plain strings —
  // avoids timezone drift from parsing into Date objects. Mirrors the DB's
  // own leave_requests_date_range_check constraint (0001_initial_schema.sql)
  // so the error is a friendly message here, not a raw constraint violation.
  if (parsed.endDate < parsed.startDate) {
    return "End date can't be before start date.";
  }
  if (!LEAVE_TYPES.includes(parsed.leaveType as (typeof LEAVE_TYPES)[number])) {
    return "Choose a leave type.";
  }
  if (!parsed.reason) return "Reason is required.";
  return null;
}

export async function requestLeave(
  _prevState: LeaveRequestFormState,
  formData: FormData,
): Promise<LeaveRequestFormState> {
  const user = await requireUser();

  const parsed = parseLeaveForm(formData);
  const validationError = validateLeaveForm(parsed);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    start_date: parsed.startDate,
    end_date: parsed.endDate,
    leave_type: parsed.leaveType,
    reason: parsed.reason,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/leave");
  redirect("/dashboard/leave");
}
