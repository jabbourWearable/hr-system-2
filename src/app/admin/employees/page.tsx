import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Admin-only employee account management (spec §5.9, task list Task 19).
// `profiles`/`sites` are readable by any authenticated user per RLS
// (0002_rls_policies.sql), but this route itself is gated by
// requireRole('admin') like every other page under /admin — see
// ARCHITECTURE.md's note that each page must call this itself.
export default async function AdminEmployeesPage() {
  await requireRole("admin");
  const supabase = await createClient();

  const [{ data: profiles }, { data: sites }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, employee_code, role, manager_id, site_id")
      .order("full_name"),
    supabase.from("sites").select("id, name"),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Employee accounts</h1>
          <p className="text-sm text-foreground-muted">
            Manage role, manager, and work site assignment for everyone.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
          Back to admin
        </Link>
      </div>

      {!profiles || profiles.length === 0 ? (
        <p className="text-sm text-foreground-muted">No employee accounts yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Employee code</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Manager</th>
                <th className="px-3 py-2 font-medium">Site</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-t border-border">
                  <td className="px-3 py-2">{profile.full_name}</td>
                  <td className="px-3 py-2">{profile.email ?? "—"}</td>
                  <td className="px-3 py-2">{profile.employee_code ?? "—"}</td>
                  <td className="px-3 py-2 capitalize">{profile.role}</td>
                  <td className="px-3 py-2">
                    {profile.manager_id
                      ? nameById.get(profile.manager_id) ?? "Unknown"
                      : "Unassigned"}
                  </td>
                  <td className="px-3 py-2">
                    {profile.site_id
                      ? siteNameById.get(profile.site_id) ?? "Unknown"
                      : "Unassigned"}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/employees/${profile.id}/edit`}
                      className="font-medium text-primary hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
