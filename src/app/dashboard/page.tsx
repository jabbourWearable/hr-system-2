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

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Welcome, {user.fullName}</h1>
          <p className="text-sm text-foreground-muted">{user.email}</p>
        </div>
        <LogoutButton />
      </div>
      <dl className="grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-foreground-muted">Role</dt>
        <dd className="capitalize">{user.role}</dd>
        <dt className="text-foreground-muted">Employee code</dt>
        <dd>{user.employeeCode ?? "Not assigned yet"}</dd>
        <dt className="text-foreground-muted">Manager</dt>
        <dd>{user.managerId ?? "Not assigned yet"}</dd>
        <dt className="text-foreground-muted">Site</dt>
        <dd>{user.siteId ?? "Not assigned yet"}</dd>
      </dl>
      <section className="max-w-sm space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Attendance
        </h2>
        <CheckInOut
          hasSite={Boolean(user.siteId)}
          siteName={site?.name ?? null}
          initialIsCheckedIn={Boolean(openRecord)}
        />
        <nav className="flex flex-col gap-1 pt-1">
          <Link href="/dashboard/attendance" className="font-medium text-primary hover:underline">
            My attendance history
          </Link>
          {user.role === "manager" && (
            <Link
              href="/dashboard/attendance/team"
              className="font-medium text-primary hover:underline"
            >
              My team&apos;s attendance history
            </Link>
          )}
        </nav>
      </section>
      <section className="max-w-sm space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Leave
        </h2>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/dashboard/leave" className="font-medium text-primary hover:underline">
            Request leave / view my requests
          </Link>
          {user.role === "manager" && (
            <Link
              href="/dashboard/leave/approvals"
              className="font-medium text-primary hover:underline"
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
