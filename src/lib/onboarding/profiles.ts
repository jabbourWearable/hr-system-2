import "server-only";
import type { createClient } from "@/lib/supabase/server";

export type PersonProfile = { fullName: string; employeeCode: string | null };

// Same id -> profile lookup shape as src/lib/leave/requester-profiles.ts and
// src/lib/attendance/employee-profiles.ts, kept as its own copy per those
// files' own comment (independent features that happen to need the same
// small query, and the hand-written Database type has no FK relationship
// metadata for a PostgREST embedded select).
export async function loadProfilesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, PersonProfile>> {
  if (ids.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code")
    .in("id", ids);

  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      { fullName: profile.full_name, employeeCode: profile.employee_code },
    ]),
  );
}
