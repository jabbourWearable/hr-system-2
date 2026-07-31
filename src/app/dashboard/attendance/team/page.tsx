import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadEmployeeProfiles } from "@/lib/attendance/employee-profiles";
import { loadSiteNames } from "@/lib/attendance/site-names";
import { formatAttendanceDate, formatAttendanceTime } from "@/lib/attendance/format";
import { nextDayExclusive } from "@/lib/attendance/date-range";
import { AttendanceFilters } from "@/components/attendance/attendance-filters";

// Manager-only team attendance history (spec §5 item 5 / §5.9, task list
// Task 13). RLS (attendance_select_manager) already scopes the base query to
// rows where the requester's manager_id is this manager — the employeeId/
// from/to params below only narrow further, they can't widen access. The
// company-wide equivalent lives at /admin/attendance (its own
// requireRole('admin') page).
export default async function TeamAttendanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; from?: string; to?: string }>;
}) {
  const user = await requireRole("manager");
  const { employeeId, from, to } = await searchParams;
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("manager_id", user.id)
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
          <h1 className="text-xl font-semibold">Team attendance history</h1>
          <p className="text-sm text-foreground-muted">
            Check-in/check-out log for your direct reports.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>

      <AttendanceFilters
        action="/dashboard/attendance/team"
        employees={(reports ?? []).map((report) => ({ id: report.id, fullName: report.full_name }))}
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
