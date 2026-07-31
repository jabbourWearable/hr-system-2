"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { haversineDistanceMeters } from "@/lib/geo/haversine";

export type AttendanceActionResult = { error: string } | { message: string };

const NO_SITE_ERROR = "No work site assigned — contact your admin.";

async function loadSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
) {
  const { data } = await supabase
    .from("sites")
    .select("id, name, latitude, longitude, radius_meters")
    .eq("id", siteId)
    .single();
  return data;
}

// Called directly from the dashboard's Client Component (not bound to a
// <form>) once the browser's Geolocation API resolves — see
// src/app/dashboard/check-in-out.tsx. Distance/radius validation happens
// here, server-side, so it can't be bypassed by editing client code.
export async function checkIn(
  latitude: number,
  longitude: number,
): Promise<AttendanceActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  if (!user.siteId) {
    return { error: NO_SITE_ERROR };
  }

  const site = await loadSite(supabase, user.siteId);
  if (!site) {
    return { error: "Assigned work site could not be found — contact your admin." };
  }

  const { data: openRecord } = await supabase
    .from("attendance")
    .select("id")
    .eq("user_id", user.id)
    .is("check_out_at", null)
    .maybeSingle();

  if (openRecord) {
    return { error: "You're already checked in — check out first." };
  }

  const distance = haversineDistanceMeters(
    latitude,
    longitude,
    site.latitude,
    site.longitude,
  );

  if (distance > site.radius_meters) {
    return {
      error: `You're ${Math.round(distance)}m from ${site.name} — outside the ${site.radius_meters}m check-in radius.`,
    };
  }

  const { error } = await supabase.from("attendance").insert({
    user_id: user.id,
    site_id: site.id,
    check_in_at: new Date().toISOString(),
    check_in_lat: latitude,
    check_in_lng: longitude,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { message: `Checked in at ${site.name}.` };
}

export async function checkOut(
  latitude: number,
  longitude: number,
): Promise<AttendanceActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: openRecord } = await supabase
    .from("attendance")
    .select("id, site_id")
    .eq("user_id", user.id)
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openRecord) {
    return { error: "You're not checked in." };
  }

  // Validate against the site the employee actually checked into, not
  // whatever profiles.site_id is now — an admin may reassign the employee's
  // site while a shift is still open.
  const site = await loadSite(supabase, openRecord.site_id);
  if (!site) {
    return { error: "The site for this check-in could not be found — contact your admin." };
  }

  const distance = haversineDistanceMeters(
    latitude,
    longitude,
    site.latitude,
    site.longitude,
  );

  if (distance > site.radius_meters) {
    return {
      error: `You're ${Math.round(distance)}m from ${site.name} — outside the ${site.radius_meters}m check-out radius.`,
    };
  }

  const { error } = await supabase
    .from("attendance")
    .update({
      check_out_at: new Date().toISOString(),
      check_out_lat: latitude,
      check_out_lng: longitude,
    })
    .eq("id", openRecord.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { message: `Checked out from ${site.name}.` };
}
