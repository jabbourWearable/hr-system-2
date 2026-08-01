import "server-only";
import type { createClient } from "@/lib/supabase/server";

export type PersonProfile = { fullName: string; managerId: string | null };

// Same id -> profile lookup shape as src/lib/onboarding/profiles.ts and
// src/lib/leave/requester-profiles.ts, kept as its own copy per those files'
// own comment (the hand-written Database type has no FK relationship
// metadata for a PostgREST embedded select). Shared across the reviews/
// goals/one-on-ones pages within this one feature (HR-78), rather than a
// fourth near-identical copy, since they're not independent features.
export async function loadProfilesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, PersonProfile>> {
  if (ids.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, manager_id")
    .in("id", ids);

  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      { fullName: profile.full_name, managerId: profile.manager_id },
    ]),
  );
}
