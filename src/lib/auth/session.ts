import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/types/database";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  fullName: string;
  employeeCode: string | null;
  role: Role;
  managerId: string | null;
  siteId: string | null;
};

/**
 * Data Access Layer entry point: resolves the current request's user +
 * profile once per render pass (memoized via React `cache`), so calling it
 * from a layout and again from a page doesn't re-query Supabase.
 *
 * Returns null when there is no session — callers decide whether that's
 * fatal (see requireUser/requireRole below).
 */
export const getAuthenticatedUser = cache(
  async (): Promise<AuthenticatedUser | null> => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, employee_code, role, manager_id, site_id")
      .eq("id", user.id)
      .single();

    if (!profile) return null;

    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile.full_name,
      employeeCode: profile.employee_code,
      role: profile.role,
      managerId: profile.manager_id,
      siteId: profile.site_id,
    };
  },
);

/**
 * Use at the top of any authenticated page (e.g. app/dashboard/layout.tsx).
 * Any signed-in user passes, regardless of role.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Use at the top of a role-gated page (e.g. app/admin/layout.tsx).
 * proxy.ts only checks that *a* session exists; the actual role check
 * happens here, server-side, against profiles.role — never trust a
 * client-supplied role.
 */
export async function requireRole(role: Role): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (user.role !== role) redirect("/dashboard");
  return user;
}
