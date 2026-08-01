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

  const [{ data: profiles }, { data: sites }, { data: emailRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, employee_code, role, manager_id, site_id")
      .order("full_name"),
    supabase.from("sites").select("id, name"),
    // `email` isn't in the original schema (migration 0007 backfills it via a
    // DB trigger) — select it separately so a not-yet-applied migration can't
    // 42703 the whole employee list, only the email column.
    supabase.from("profiles").select("id, email"),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const siteNameById = new Map((sites ?? []).map((s) => [s.id, s.name]));
  const emailById = new Map((emailRows ?? []).map((p) => [p.id, p.email]));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Employee accounts</h1>
          <p className="text-sm text-mute">
            Manage role, manager, and work site assignment for everyone.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-link hover:underline">
          Back to admin
        </Link>
      </div>

      {!profiles || profiles.length === 0 ? (
        <p className="text-sm text-mute">No employee accounts yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-hairline-strong text-left">
              <tr>
                <th className="section-label px-4 py-3">Name</th>
                <th className="section-label px-4 py-3">Email</th>
                <th className="section-label px-4 py-3">Employee code</th>
                <th className="section-label px-4 py-3">Role</th>
                <th className="section-label px-4 py-3">Manager</th>
                <th className="section-label px-4 py-3">Site</th>
                <th className="section-label px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td className="px-4 py-3 text-ink">{profile.full_name}</td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {emailById.get(profile.id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {profile.employee_code ?? "—"}
                  </td>
                  <td className="px-4 py-3 capitalize">{profile.role}</td>
                  <td className="px-4 py-3">
                    {profile.manager_id
                      ? nameById.get(profile.manager_id) ?? "Unknown"
                      : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    {profile.site_id
                      ? siteNameById.get(profile.site_id) ?? "Unknown"
                      : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/employees/${profile.id}/edit`}
                      className="font-medium text-link hover:underline"
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
