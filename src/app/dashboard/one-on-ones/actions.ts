"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OneOnOneNoteVisibility } from "@/types/database";

export type ActionState = { error: string } | { message: string } | undefined;

// Manager-only — schedules a 1:1 with one of their own direct reports.
// one_on_ones_insert_manager (0010_performance_reviews_goals.sql) is what
// actually authorizes the write (checks manager_id = auth.uid() AND
// is_manager_of(employee_id)); this just surfaces a friendly error instead
// of a raw RLS violation if someone tampers with the employee id client-side.
export async function scheduleOneOnOne(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const manager = await requireRole("manager");

  const employeeId = String(formData.get("employeeId") ?? "").trim();
  if (!employeeId) return { error: "Select a direct report." };

  const meetingDate = String(formData.get("meetingDate") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) return { error: "Pick a valid date." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("one_on_ones")
    .insert({
      employee_id: employeeId,
      manager_id: manager.id,
      meeting_date: meetingDate,
      created_by: manager.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not schedule this 1:1." };
  }

  revalidatePath("/dashboard/one-on-ones");
  redirect(`/dashboard/one-on-ones/${data.id}`);
}

export async function markOneOnOneCompleted(oneOnOneId: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("one_on_ones")
    .update({ status: "completed" })
    .eq("id", oneOnOneId)
    .or(`employee_id.eq.${user.id},manager_id.eq.${user.id}`);

  revalidatePath(`/dashboard/one-on-ones/${oneOnOneId}`);
  revalidatePath("/dashboard/one-on-ones");
}

// Saves the caller's own note on a 1:1 (select-then-insert-or-update, not
// an upsert — the table's uniqueness rules are two *partial* indexes
// (one_on_one_notes_shared_unique / _private_unique in
// 0010_performance_reviews_goals.sql), and Postgres can't target a partial
// index's arbiter via a plain ON CONFLICT(columns) clause, which is all
// PostgREST's upsert() can express). 'private' notes are only ever the
// caller's own; 'shared' is a single note either participant may create or
// later edit (one_on_one_notes_update_shared_participant covers the other
// participant editing a note they didn't originally author).
export async function saveOneOnOneNote(
  oneOnOneId: string,
  visibility: OneOnOneNoteVisibility,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const body = String(formData.get("body") ?? "");

  const supabase = await createClient();

  let existingQuery = supabase
    .from("one_on_one_notes")
    .select("id")
    .eq("one_on_one_id", oneOnOneId)
    .eq("visibility", visibility);
  if (visibility === "private") {
    existingQuery = existingQuery.eq("author_id", user.id);
  }
  const { data: existing } = await existingQuery.maybeSingle();

  const { error } = existing
    ? await supabase.from("one_on_one_notes").update({ body }).eq("id", existing.id)
    : await supabase
        .from("one_on_one_notes")
        .insert({ one_on_one_id: oneOnOneId, author_id: user.id, visibility, body });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/one-on-ones/${oneOnOneId}`);
  return { message: "Saved." };
}
