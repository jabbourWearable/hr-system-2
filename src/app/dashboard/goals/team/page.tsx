import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { groupGoalsWithRollup } from "@/lib/performance/goals";
import { GoalStatusBadge } from "@/components/performance/status-badges";

// Manager-only, read-only view of direct reports' OKRs (HR-78). RLS
// (goals_select_manager, 0010_performance_reviews_goals.sql) already scopes
// the query to this manager's own direct reports — the
// `.in("employee_id", reportIds)` filter below just narrows the same set
// explicitly, same convention as /dashboard/onboarding/team. The
// company-wide equivalent lives at /admin/goals (its own requireRole
// ('admin') page). Goal ownership stays with the employee — this page has
// no edit affordance.
export default async function TeamGoalsPage() {
  const user = await requireRole("manager");
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("manager_id", user.id)
    .order("full_name");

  const reportIds = (reports ?? []).map((r) => r.id);
  const nameById = new Map((reports ?? []).map((r) => [r.id, r.full_name]));

  const { data: goals } = reportIds.length
    ? await supabase
        .from("goals")
        .select("id, employee_id, goal_type, parent_goal_id, title, description, status, progress, due_date")
        .in("employee_id", reportIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const goalsByEmployee = new Map<string, typeof goals>();
  for (const goal of goals ?? []) {
    const list = goalsByEmployee.get(goal.employee_id) ?? [];
    list.push(goal);
    goalsByEmployee.set(goal.employee_id, list);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Team goals &amp; OKRs</h1>
          <p className="text-sm text-mute">Read-only view of your direct reports&apos; goals.</p>
        </div>
        <Link href="/dashboard/goals" className="text-sm font-medium text-link hover:underline">
          Back to your goals
        </Link>
      </div>

      {reportIds.length === 0 ? (
        <p className="text-sm text-mute">You have no direct reports yet.</p>
      ) : (
        <div className="space-y-6">
          {reportIds.map((reportId) => {
            const grouped = groupGoalsWithRollup(goalsByEmployee.get(reportId) ?? []);
            return (
              <section key={reportId} className="space-y-3">
                <h2 className="section-label">{nameById.get(reportId)}</h2>
                {grouped.length === 0 ? (
                  <p className="text-sm text-mute">No goals yet.</p>
                ) : (
                  <div className="card divide-y divide-hairline">
                    {grouped.map((goal) => (
                      <div key={goal.id} className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-ink">{goal.title}</p>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[13px] text-mute">
                              {goal.effectiveProgress}%
                            </span>
                            <GoalStatusBadge status={goal.status} />
                          </div>
                        </div>
                        {goal.children.length > 0 && (
                          <ul className="mt-2 space-y-1.5 pl-4">
                            {goal.children.map((kr) => (
                              <li
                                key={kr.id}
                                className="flex flex-wrap items-center justify-between gap-3"
                              >
                                <p className="text-sm text-body">{kr.title}</p>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-[12px] text-mute">
                                    {kr.progress}%
                                  </span>
                                  <GoalStatusBadge status={kr.status} />
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
