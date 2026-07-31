import "server-only";
import type { createClient } from "@/lib/supabase/server";

export async function loadSiteNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteIds: string[],
): Promise<Map<string, string>> {
  if (siteIds.length === 0) return new Map();

  const { data } = await supabase
    .from("sites")
    .select("id, name")
    .in("id", siteIds);

  return new Map((data ?? []).map((site) => [site.id, site.name]));
}
