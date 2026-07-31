"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type SiteFormState = { error: string } | undefined;
export type DeleteSiteState = { error: string } | undefined;

type ParsedSite = {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

function parseSiteForm(formData: FormData): ParsedSite {
  return {
    name: String(formData.get("name") ?? "").trim(),
    latitude: Number(formData.get("latitude")),
    longitude: Number(formData.get("longitude")),
    radiusMeters: Number(formData.get("radiusMeters")),
  };
}

// No fixed default radius per spec §11 Q5 — this only rejects invalid
// input, it never fills in a default value for a missing one.
function validateSiteForm(site: ParsedSite): string | null {
  if (!site.name) return "Name is required.";
  if (!Number.isFinite(site.latitude) || site.latitude < -90 || site.latitude > 90) {
    return "Latitude must be a number between -90 and 90.";
  }
  if (!Number.isFinite(site.longitude) || site.longitude < -180 || site.longitude > 180) {
    return "Longitude must be a number between -180 and 180.";
  }
  if (!Number.isFinite(site.radiusMeters) || site.radiusMeters <= 0) {
    return "Radius (meters) must be a positive number.";
  }
  return null;
}

export async function createSite(
  _prevState: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  await requireRole("admin");

  const parsed = parseSiteForm(formData);
  const validationError = validateSiteForm(parsed);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("sites").insert({
    name: parsed.name,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    radius_meters: parsed.radiusMeters,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/sites");
  redirect("/admin/sites");
}

export async function updateSite(
  id: string,
  _prevState: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  await requireRole("admin");

  const parsed = parseSiteForm(formData);
  const validationError = validateSiteForm(parsed);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sites")
    .update({
      name: parsed.name,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      radius_meters: parsed.radiusMeters,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/sites");
  redirect("/admin/sites");
}

// Postgres error 23503 = foreign_key_violation. attendance.site_id is
// `on delete restrict` (supabase/migrations/0001_initial_schema.sql), so
// deleting a site with attendance history fails here instead of silently
// orphaning those rows; profiles.site_id is `on delete set null`, so an
// employee's site assignment is cleared automatically (not an FK error).
const FOREIGN_KEY_VIOLATION = "23503";

export async function deleteSite(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState signature
  _prevState: DeleteSiteState,
): Promise<DeleteSiteState> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("sites").delete().eq("id", id);

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return {
        error:
          "This site has attendance records tied to it and can't be deleted. Reassign or remove those records first.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/sites");
  return undefined;
}
