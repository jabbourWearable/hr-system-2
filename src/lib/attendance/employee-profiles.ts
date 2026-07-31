import "server-only";
import type { createClient } from "@/lib/supabase/server";

export type EmployeeProfile = { fullName: string; employeeCode: string | null };

// Same id -> profile lookup shape as src/lib/leave/requester-profiles.ts, kept
// as its own copy here (rather than a cross-feature import) since attendance
// and leave are independent features that happen to need the same small
// query. See that file's comment for why this isn't a PostgREST embedded
// select: the hand-written Database type has no FK relationship metadata.
export async function loadEmployeeProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, EmployeeProfile>> {
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
