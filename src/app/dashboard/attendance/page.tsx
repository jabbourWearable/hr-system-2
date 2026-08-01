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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">My attendance history</h1>
          <p className="text-sm text-mute">
            Your check-in/check-out log, newest first.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Back to dashboard
        </Link>
      </div>

      {!records || records.length === 0 ? (
        <p className="text-sm text-mute">No attendance records yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-hairline-strong text-left">
              <tr>
                <th className="section-label px-4 py-3">Date</th>
                <th className="section-label px-4 py-3">Check-in</th>
                <th className="section-label px-4 py-3">Check-out</th>
                <th className="section-label px-4 py-3">Site</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {formatAttendanceDate(record.check_in_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {formatAttendanceTime(record.check_in_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {formatAttendanceTime(record.check_out_at)}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {siteNames.get(record.site_id) ?? "Unknown site"}
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
