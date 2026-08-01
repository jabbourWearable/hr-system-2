import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";
import { CheckInOut } from "./check-in-out";
import { NotificationsList } from "./notifications-list";

// Reference implementation of the auth-guard pattern: any authenticated
// user (employee/manager/admin) may reach /dashboard. Future nested routes
// under /dashboard must call requireUser() again at the top of their own
// page — see the note in ARCHITECTURE.md about not relying on a shared
// layout for the auth check.
export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: site }, { data: openRecord }, { data: notifications }] = await Promise.all([
    user.siteId
      ? supabase.from("sites").select("name").eq("id", user.siteId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("attendance")
      .select("id")
      .eq("user_id", user.id)
      .is("check_out_at", null)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id, message, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const profileFacts = [
    { label: "Role", value: user.role, mono: false, capitalize: true },
    { label: "Employee code", value: user.employeeCode ?? "Not assigned yet", mono: true },
    { label: "Manager", value: user.managerId ?? "Not assigned yet", mono: true },
    { label: "Site", value: site?.name ?? user.siteId ?? "Not assigned yet", mono: false },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl sm:text-4xl">
            Welcome, {user.fullName}
          </h1>
          <p className="font-mono text-sm text-mute">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Profile</h2>
        <dl className="card grid grid-cols-2 gap-x-6 gap-y-4 p-6 sm:grid-cols-4">
          {profileFacts.map((fact) => (
            <div key={fact.label} className="space-y-1">
              <dt className="section-label">{fact.label}</dt>
              <dd
                className={`break-all text-sm text-ink ${fact.mono ? "font-mono text-[13px]" : ""} ${
                  fact.capitalize ? "capitalize" : ""
                }`}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Attendance</h2>
        <div className="card max-w-md space-y-3 p-6">
          <CheckInOut
            hasSite={Boolean(user.siteId)}
            siteName={site?.name ?? null}
            initialIsCheckedIn={Boolean(openRecord)}
          />
        </div>
        <nav className="flex flex-col gap-1.5 pt-1 text-sm">
          <Link href="/dashboard/attendance" className="font-medium text-link hover:underline">
            My attendance history
          </Link>
          {user.role === "manager" && (
            <Link
              href="/dashboard/attendance/team"
              className="font-medium text-link hover:underline"
            >
              My team&apos;s attendance history
            </Link>
          )}
        </nav>
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Leave</h2>
        <nav className="flex flex-col gap-1.5 text-sm">
          <Link href="/dashboard/leave" className="font-medium text-link hover:underline">
            Request leave / view my requests
          </Link>
          {user.role === "manager" && (
            <Link
              href="/dashboard/leave/approvals"
              className="font-medium text-link hover:underline"
            >
              Review my team&apos;s leave requests
            </Link>
          )}
        </nav>
      </section>

      <NotificationsList userId={user.id} initialNotifications={notifications ?? []} />
    </main>
  );
}
