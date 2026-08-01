import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";
import { AvatarBadge } from "@/components/people/avatar-badge";
import { CelebrationsCard } from "@/components/people/celebrations-card";
import { upcomingCelebrations } from "@/lib/people/celebrations";
import { CheckInOut } from "./check-in-out";
import { NotificationsList } from "./notifications-list";

const PEOPLE_LINKS = [
  { href: "/dashboard/directory", label: "Company directory" },
  { href: "/dashboard/org", label: "Org chart" },
  { href: "/dashboard/kudos", label: "Kudos" },
];

// Reference implementation of the auth-guard pattern: any authenticated
// user (employee/manager/admin) may reach /dashboard. Future nested routes
// under /dashboard must call requireUser() again at the top of their own
// page — see the note in ARCHITECTURE.md about not relying on a shared
// layout for the auth check.
export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [
    { data: site },
    { data: openRecord },
    { data: notifications },
    { data: allPeople },
    { data: recentKudos },
  ] = await Promise.all([
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
    // People Hub (HR-68): everyone, for celebrations + kudos name resolution.
    supabase.from("profiles").select("id, full_name, department, birthday, start_date"),
    supabase
      .from("kudos")
      .select("id, giver_id, recipient_id, category, message, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // Upcoming birthdays / work anniversaries in the next 30 days (top 6).
  const todayISO = new Date().toISOString().slice(0, 10);
  const celebrations = upcomingCelebrations(
    (allPeople ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      department: p.department,
      birthday: p.birthday,
      start_date: p.start_date,
    })),
    { todayISO, windowDays: 30 },
  ).slice(0, 6);

  const nameById = new Map((allPeople ?? []).map((p) => [p.id, p.full_name]));

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
        <h2 className="section-label">People</h2>
        <nav className="flex flex-wrap gap-2">
          {PEOPLE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-hairline-strong bg-elevated px-3.5 py-1.5 text-sm font-medium text-body transition-colors hover:border-stone hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <CelebrationsCard celebrations={celebrations} />

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="section-label">Recent recognition</h2>
            <Link
              href="/dashboard/kudos"
              className="text-sm font-medium text-link hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="card divide-y divide-hairline">
            {!recentKudos || recentKudos.length === 0 ? (
              <p className="p-6 text-sm text-mute">
                No kudos yet.{" "}
                <Link href="/dashboard/kudos" className="text-link hover:underline">
                  Recognize a colleague →
                </Link>
              </p>
            ) : (
              recentKudos.map((k) => (
                <div key={k.id} className="flex items-start gap-3 p-4">
                  <AvatarBadge
                    name={nameById.get(k.giver_id) ?? "?"}
                    seed={k.giver_id}
                    size={36}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm">
                      <span className="font-medium text-ink">
                        {nameById.get(k.giver_id) ?? "Someone"}
                      </span>
                      <span className="text-mute"> recognized </span>
                      <Link
                        href={`/dashboard/directory/${k.recipient_id}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {nameById.get(k.recipient_id) ?? "a colleague"}
                      </Link>
                    </p>
                    <p className="line-clamp-2 text-sm text-body">{k.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

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
