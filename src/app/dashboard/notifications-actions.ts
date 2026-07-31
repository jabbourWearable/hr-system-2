"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type MarkReadResult = { error: string } | { ok: true };

// Called directly from the dashboard's notifications Client Component (not
// bound to a <form>), same pattern as checkIn/checkOut in
// attendance-actions.ts. notifications_update_own (0002_rls_policies.sql)
// already scopes this to the caller's own rows; the explicit .eq("user_id",
// ...) below is defense in depth, matching that file's convention.
export async function markNotificationRead(notificationId: string): Promise<MarkReadResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { ok: true };
}
