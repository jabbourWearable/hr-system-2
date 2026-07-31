import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadEmployeeProfiles } from "@/lib/attendance/employee-profiles";
import { loadSiteNames } from "@/lib/attendance/site-names";
import { formatAttendanceDate, formatAttendanceTime } from "@/lib/attendance/format";
import { nextDayExclusive } from "@/lib/attendance/date-range";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";

// Admin-only, company-wide attendance history (spec §5 item 5 / §5.9
// "company-wide attendance & leave overview", task list Task 13). RLS
// (attendance_admin_all) already grants this role unrestricted access — the
// employeeId/from/to params below only narrow the result set. Gated by
// requireRole('admin') here — see ARCHITECTURE.md's note that every page
// under /admin must call this itself, not rely on a shared layout.
export default async function AdminAttendanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; from?: string; to?: string }>;
}) {
  await requireRole("admin");
  const { employeeId, from, to } = await searchParams;
  const supabase = await createClient();

  const { data: allEmployees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  let query = supabase
    .from("attendance")
    .select("id, user_id, site_id, check_in_at, check_out_at")
    .order("check_in_at", { ascending: false });

  if (employeeId) query = query.eq("user_id", employeeId);
  if (from) query = query.gte("check_in_at", from);
  if (to) query = query.lt("check_in_at", nextDayExclusive(to));

  const { data: records } = await query;

  const [employeeProfiles, siteNames] = await Promise.all([
    loadEmployeeProfiles(supabase, [...new Set((records ?? []).map((r) => r.user_id))]),
    loadSiteNames(supabase, [...new Set((records ?? []).map((r) => r.site_id))]),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Company attendance history</h1>
          <p className="text-sm text-foreground-muted">
            Check-in/check-out log for everyone.
          </p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
          Back to admin
        </Link>
      </div>

      <AttendanceFilters
        action="/admin/attendance"
        employees={(allEmployees ?? []).map((employee) => ({
          id: employee.id,
          fullName: employee.full_name,
        }))}
        defaultEmployeeId={employeeId}
        defaultFrom={from}
        defaultTo={to}
      />

      {!records || records.length === 0 ? (
        <p className="text-sm text-foreground-muted">No attendance records match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Check-in</th>
                <th className="px-3 py-2 font-medium">Check-out</th>
                <th className="px-3 py-2 font-medium">Site</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {employeeProfiles.get(record.user_id)?.fullName ?? "Unknown employee"}
                  </td>
                  <td className="px-3 py-2">{formatAttendanceDate(record.check_in_at)}</td>
                  <td className="px-3 py-2">{formatAttendanceTime(record.check_in_at)}</td>
                  <td className="px-3 py-2">{formatAttendanceTime(record.check_out_at)}</td>
                  <td className="px-3 py-2">{siteNames.get(record.site_id) ?? "Unknown site"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
