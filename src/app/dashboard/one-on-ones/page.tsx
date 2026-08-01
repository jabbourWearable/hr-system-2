import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/performance/profiles";
import { OneOnOneStatusBadge } from "@/components/performance/status-badges";

// 1:1 meeting list (HR-78) — any authenticated user sees meetings where
// they're the employee; managers additionally see meetings where they're
// the manager. RLS (one_on_ones_select_employee/_select_manager,
// 0010_performance_reviews_goals.sql) already scopes both queries. Note
// bodies are never loaded here — only on the single-meeting detail page,
// where RLS narrows what each viewer can actually read.
export default async function OneOnOnesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: withManager }, { data: withReports }] = await Promise.all([
    supabase
      .from("one_on_ones")
      .select("id, manager_id, meeting_date, status")
      .eq("employee_id", user.id)
      .order("meeting_date", { ascending: false }),
    supabase
      .from("one_on_ones")
      .select("id, employee_id, meeting_date, status")
      .eq("manager_id", user.id)
      .order("meeting_date", { ascending: false }),
  ]);

  const otherIds = [
    ...new Set([
      ...(withManager ?? []).map((m) => m.manager_id),
      ...(withReports ?? []).map((m) => m.employee_id),
    ]),
  ];
  const profileMap = await loadProfilesByIds(supabase, otherIds);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">1:1s</h1>
          <p className="text-sm text-mute">Meeting notes with your manager or your reports.</p>
        </div>
        <div className="flex items-center gap-3">
          {user.role === "manager" && (
            <Link href="/dashboard/one-on-ones/new" className="btn btn-primary">
              Schedule 1:1
            </Link>
          )}
          <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">With your manager</h2>
        {!withManager || withManager.length === 0 ? (
          <p className="text-sm text-mute">No 1:1s scheduled yet.</p>
        ) : (
          <ul className="card divide-y divide-hairline">
            {withManager.map((meeting) => (
              <li key={meeting.id}>
                <Link
                  href={`/dashboard/one-on-ones/${meeting.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-elevated"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-ink">
                      {profileMap.get(meeting.manager_id)?.fullName ?? "Manager"}
                    </p>
                    <p className="font-mono text-[13px] text-mute">{meeting.meeting_date}</p>
                  </div>
                  <OneOnOneStatusBadge status={meeting.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.role === "manager" && (
        <section className="space-y-3">
          <h2 className="section-label">With your reports</h2>
          {!withReports || withReports.length === 0 ? (
            <p className="text-sm text-mute">No 1:1s scheduled yet.</p>
          ) : (
            <ul className="card divide-y divide-hairline">
              {withReports.map((meeting) => (
                <li key={meeting.id}>
                  <Link
                    href={`/dashboard/one-on-ones/${meeting.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-elevated"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-ink">
                        {profileMap.get(meeting.employee_id)?.fullName ?? "Employee"}
                      </p>
                      <p className="font-mono text-[13px] text-mute">{meeting.meeting_date}</p>
                    </div>
                    <OneOnOneStatusBadge status={meeting.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
