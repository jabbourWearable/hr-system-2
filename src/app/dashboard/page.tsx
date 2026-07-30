import { requireUser } from "@/lib/auth/session";

// Reference implementation of the auth-guard pattern: any authenticated
// user (employee/manager/admin) may reach /dashboard. Future nested routes
// under /dashboard must call requireUser() again at the top of their own
// page — see the note in ARCHITECTURE.md about not relying on a shared
// layout for the auth check.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="flex flex-1 flex-col gap-2 px-6 py-8">
      <h1 className="text-xl font-semibold">Welcome, {user.fullName}</h1>
      <p className="text-sm text-foreground-muted">Role: {user.role}</p>
      {/* Check-in/out, attendance history, leave requests, notifications
          (HR-11..HR-14) build out from here. */}
    </main>
  );
}
