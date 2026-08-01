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

  const adminLinks = [
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/employees", label: "Employee accounts" },
    { href: "/admin/sites", label: "Work sites" },
    { href: "/admin/attendance", label: "Attendance history" },
    { href: "/admin/leave", label: "Leave approvals" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl sm:text-4xl">Admin</h1>
          <p className="text-sm text-mute">
            Signed in as {user.fullName} ({user.role}).
          </p>
        </div>
        <LogoutButton />
      </div>

      {/* sub-nav-pill row per DESIGN.md */}
      <nav className="flex flex-wrap gap-2">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-hairline-strong bg-elevated px-3.5 py-1.5 text-sm font-medium text-body transition-colors hover:border-stone hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        <h2 className="section-label">Today</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="card p-5">
              <p className="display-serif text-4xl">{stat.value}</p>
              <p className="section-label mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
