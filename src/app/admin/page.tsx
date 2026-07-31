import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/logout-button";
import { nextDayExclusive } from "@/lib/attendance/date-range";

// Company-wide admin overview (spec §5 item 9 / §5.9, task list Task 20).
// Only profiles.role = 'admin' reaches this page (server-side check — see
// src/lib/auth/session.ts). Employees/managers are redirected to
// /dashboard. Future nested routes under /admin must call requireRole
// again at the top of their own page — see ARCHITECTURE.md.
//
// Counts below are plain rollups (headcount, today's attendance, pending
// leave, sites) — no payroll/hours-worked/shift-scheduling calculations,
// per spec §6 (explicitly out of scope).
export default async function AdminPage() {
  const user = await requireRole("admin");
  const supabase = await createClient();

  const todayStart = new Date().toISOString().slice(0, 10);
  const todayEnd = nextDayExclusive(todayStart);

  const [
    { count: headcount },
    { count: checkedInToday },
    { count: currentlyCheckedIn },
    { count: pendingLeaveRequests },
    { count: siteCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("attendance")
      .select("*", { count: "exact", head: true })
      .gte("check_in_at", todayStart)
      .lt("check_in_at", todayEnd),
    supabase
      .from("attendance")
      .select("*", { count: "exact", head: true })
      .is("check_out_at", null),
    supabase
      .from("leave_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("sites").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Total headcount", value: headcount ?? 0 },
    { label: "Checked in today", value: checkedInToday ?? 0 },
    { label: "Currently checked in", value: currentlyCheckedIn ?? 0 },
    { label: "Pending leave requests", value: pendingLeaveRequests ?? 0 },
    { label: "Work sites", value: siteCount ?? 0 },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-foreground-muted">
            Signed in as {user.fullName} ({user.role}).
          </p>
        </div>
        <LogoutButton />
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-border p-4">
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="text-sm text-foreground-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin/employees" className="font-medium text-primary hover:underline">
          Employee accounts
        </Link>
        <Link href="/admin/sites" className="font-medium text-primary hover:underline">
          Work sites
        </Link>
        <Link href="/admin/attendance" className="font-medium text-primary hover:underline">
          Attendance history
        </Link>
        <Link href="/admin/leave" className="font-medium text-primary hover:underline">
          Leave approvals
        </Link>
      </nav>
    </main>
  );
}
