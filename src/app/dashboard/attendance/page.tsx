import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadSiteNames } from "@/lib/attendance/site-names";
import { formatAttendanceDate, formatAttendanceTime } from "@/lib/attendance/format";

// Employee-facing attendance history (spec §5 item 5, task list Task 12).
// Gated by requireUser() directly here, not a shared layout — see
// ARCHITECTURE.md. RLS (attendance_select_own) already scopes the query
// below to this user's own rows.
export default async function AttendanceHistoryPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("attendance")
    .select("id, site_id, check_in_at, check_out_at")
    .eq("user_id", user.id)
    .order("check_in_at", { ascending: false });

  const siteNames = await loadSiteNames(
    supabase,
    [...new Set((records ?? []).map((record) => record.site_id))],
  );

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">My attendance history</h1>
          <p className="text-sm text-foreground-muted">
            Your check-in/check-out log, newest first.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>

      {!records || records.length === 0 ? (
        <p className="text-sm text-foreground-muted">No attendance records yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Check-in</th>
                <th className="px-3 py-2 font-medium">Check-out</th>
                <th className="px-3 py-2 font-medium">Site</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-border">
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
