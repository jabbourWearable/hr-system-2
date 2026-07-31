"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/database";

export type EmployeeFormState = { error: string } | undefined;

const ROLES: Role[] = ["employee", "manager", "admin"];

function parseNullableId(value: FormDataEntryValue | null): string | null {
  const str = String(value ?? "").trim();
  return str || null;
}

// Admin-only account management (spec §5.9, task list Task 19).
// `profiles_update_admin` (0002_rls_policies.sql) is the RLS policy that
// actually authorizes this update against any row; requireRole('admin')
// here is the server-side app-layer guard on top of it.
export async function updateEmployeeProfile(
  id: string,
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  await requireRole("admin");

  const role = String(formData.get("role") ?? "");
  if (!ROLES.includes(role as Role)) return { error: "Invalid role." };

  const managerId = parseNullableId(formData.get("managerId"));
  if (managerId === id) return { error: "An employee can't be their own manager." };

  const siteId = parseNullableId(formData.get("siteId"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: role as Role, manager_id: managerId, site_id: siteId })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/employees");
  redirect("/admin/employees");
}
