import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

// Reference implementation of the auth-guard pattern: any authenticated
// user (employee/manager/admin) may reach /dashboard. Future nested routes
// under /dashboard must call requireUser() again at the top of their own
// page — see the note in ARCHITECTURE.md about not relying on a shared
// layout for the auth check.
export default async function DashboardPage() {
  const user = await requireUser();

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
      {/* Check-in/out, attendance history, leave requests, notifications
          (HR-11..HR-14) build out from here. */}
    </main>
  );
}
