import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

// Reference implementation of the role-gated route pattern: only
// profiles.role = 'admin' reaches this page (server-side check — see
// src/lib/auth/session.ts). Employees/managers are redirected to
// /dashboard. Future nested routes under /admin must call requireRole
// again at the top of their own page — see ARCHITECTURE.md.
export default async function AdminPage() {
  const user = await requireRole("admin");

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-foreground-muted">
            Signed in as {user.fullName} ({user.role}).
          </p>
        </div>
        <LogoutButton />
      </div>
      <nav className="flex gap-4 text-sm">
        <Link href="/admin/sites" className="font-medium text-primary hover:underline">
          Work sites
        </Link>
      </nav>
      {/* Employee account management, company-wide attendance & leave
          overview (HR-15) build out from here. */}
    </main>
  );
}
