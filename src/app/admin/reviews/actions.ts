"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ReviewCycleStatus } from "@/types/database";

export type ActionState = { error: string } | { message: string } | undefined;

function parseDate(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

// Admin/HR only (spec: "Review cycles, goals/OKRs, and 1:1 notes for
// managers and employees", HR-78). review_cycles_admin_all
// (0010_performance_reviews_goals.sql) is what actually authorizes these
// writes.
export async function createCycle(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("admin");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));

  const supabase = await createClient();
  const { data: cycle, error } = await supabase
    .from("review_cycles")
    .insert({
      name,
      start_date: startDate,
      end_date: endDate,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error || !cycle) return { error: error?.message ?? "Could not create cycle." };

  revalidatePath("/admin/reviews");
  redirect(`/admin/reviews/${cycle.id}`);
}

export async function setCycleStatus(cycleId: string, status: ReviewCycleStatus): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("review_cycles").update({ status }).eq("id", cycleId);

  revalidatePath(`/admin/reviews/${cycleId}`);
  revalidatePath("/admin/reviews");
}

// Creates a performance_reviews row for every employee in the company who
// doesn't already have one in this cycle — the reviewer defaults to the
// employee's current manager_id (null if they have none; an admin can still
// complete an orphaned review via performance_reviews_admin_all).
export async function generateReviews(
  cycleId: string,
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: profiles }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("id, manager_id"),
    supabase.from("performance_reviews").select("employee_id").eq("cycle_id", cycleId),
  ]);

  const alreadyHasReview = new Set((existing ?? []).map((r) => r.employee_id));
  const missing = (profiles ?? []).filter((p) => !alreadyHasReview.has(p.id));

  if (missing.length === 0) {
    return { message: "Every employee already has a review in this cycle." };
  }

  const { error } = await supabase.from("performance_reviews").insert(
    missing.map((p) => ({
      cycle_id: cycleId,
      employee_id: p.id,
      reviewer_id: p.manager_id,
    })),
  );

  if (error) return { error: error.message };

  revalidatePath(`/admin/reviews/${cycleId}`);
  return { message: `Generated ${missing.length} review(s).` };
}
