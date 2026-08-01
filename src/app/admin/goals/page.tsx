import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadProfilesByIds } from "@/lib/performance/profiles";
import { groupGoalsWithRollup } from "@/lib/performance/goals";
import { GoalStatusBadge } from "@/components/performance/status-badges";

// Company-wide, read-only OKR overview for admin/HR (HR-78). goals_admin_all
// (0010_performance_reviews_goals.sql) grants the unrestricted read; goal
// ownership/editing stays with the employee (see /dashboard/goals) — admin
// here is reporting/visibility only, same posture as /admin/attendance
// being read-only relative to the employee's own check-in/out actions.
export default async function AdminGoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string }>;
}) {
  await requireRole("admin");
  const { employee } = await searchParams;
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  let query = supabase
    .from("goals")
    .select("id, employee_id, goal_type, parent_goal_id, title, description, status, progress, due_date")
    .order("created_at", { ascending: true });

  if (employee) query = query.eq("employee_id", employee);

  const { data: goals } = await query;

  const profileMap = await loadProfilesByIds(supabase, [...new Set((goals ?? []).map((g) => g.employee_id))]);
  const grouped = groupGoalsWithRollup(goals ?? []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Goals &amp; OKRs</h1>
          <p className="text-sm text-mute">Company-wide view. Employees own their own goals.</p>
        </div>
        <Link href="/admin" className="text-sm font-medium text-link hover:underline">
          Back to admin
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <select name="employee" defaultValue={employee ?? ""} className="field w-full max-w-xs">
          <option value="">All employees</option>
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-outline btn-sm">
          Filter
        </button>
        {employee && (
          <Link href="/admin/goals" className="text-sm font-medium text-link hover:underline">
            Clear
          </Link>
        )}
      </form>

      {grouped.length === 0 ? (
        <p className="text-sm text-mute">No goals yet.</p>
      ) : (
        <ul className="space-y-3">
          {grouped.map((goal) => (
            <li key={goal.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-ink">{goal.title}</p>
                  <p className="text-sm text-mute">
                    {profileMap.get(goal.employee_id)?.fullName ?? "Unknown employee"}
                    {goal.due_date && (
                      <span className="font-mono text-[12px]"> · Due {goal.due_date}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] text-mute">
                    {goal.effectiveProgress}%
                  </span>
                  <GoalStatusBadge status={goal.status} />
                </div>
              </div>
              {goal.children.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-hairline pt-3">
                  {goal.children.map((kr) => (
                    <li key={kr.id} className="flex flex-wrap items-center justify-between gap-3 pl-4">
                      <p className="text-sm text-body">{kr.title}</p>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[12px] text-mute">{kr.progress}%</span>
                        <GoalStatusBadge status={kr.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
