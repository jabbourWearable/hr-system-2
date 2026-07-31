import "server-only";
import type { createClient } from "@/lib/supabase/server";

export type RequesterProfile = { fullName: string; employeeCode: string | null };

// The hand-written Database type (src/types/database.ts) has no FK
// relationship metadata, so a PostgREST embedded select (`leave_requests
// (..., profiles(full_name))`) doesn't type-check reliably. Fetching
// profiles separately and joining in application code avoids that, matching
// the two-query pattern already used in src/app/dashboard/page.tsx.
export async function loadRequesterProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, RequesterProfile>> {
  if (userIds.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code")
    .in("id", userIds);

  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      { fullName: profile.full_name, employeeCode: profile.employee_code },
    ]),
  );
}
