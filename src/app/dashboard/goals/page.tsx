import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { groupGoalsWithRollup } from "@/lib/performance/goals";
import { GoalStatusBadge } from "@/components/performance/status-badges";
import { updateGoal, deleteGoal } from "./actions";
import { GoalRowForm } from "./goal-row-form";
import { AddGoalForm } from "./add-goal-form";

// Employee's own OKRs (HR-78) — full ownership (create/edit/delete).
// goals_select_own/_insert_own/_update_own/_delete_own
// (0010_performance_reviews_goals.sql) scope every query/write to the
// caller's own goals; the explicit `.eq("employee_id", user.id)` below just
// makes the intent readable, same convention as every other /dashboard page.
export default async function DashboardGoalsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: goals } = await supabase
    .from("goals")
    .select("id, goal_type, parent_goal_id, title, description, status, progress, due_date, employee_id")
    .eq("employee_id", user.id)
    .order("created_at", { ascending: true });

  const grouped = groupGoalsWithRollup(goals ?? []);
  const objectives = (goals ?? [])
    .filter((g) => g.goal_type === "objective")
    .map((g) => ({ id: g.id, title: g.title }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Goals &amp; OKRs</h1>
          <p className="text-sm text-mute">Track your objectives, key results, and goals.</p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Back to dashboard
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="section-label">Your goals</h2>
        {grouped.length === 0 ? (
          <p className="text-sm text-mute">No goals yet — add one below.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((goal) => (
              <div key={goal.id} className="card p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="section-label">
                      {goal.goal_type === "objective" ? "Objective" : "Goal"}
                    </span>
                    <span className="font-mono text-[13px] text-mute">
                      {goal.effectiveProgress}%
                    </span>
                  </div>
                  <GoalStatusBadge status={goal.status} />
                </div>
                <GoalRowForm
                  action={updateGoal.bind(null, goal.id)}
                  onDelete={deleteGoal.bind(null, goal.id)}
                  goal={goal}
                />
                {goal.children.length > 0 && (
                  <div className="mt-4 space-y-4 border-t border-hairline pt-4 pl-4">
                    {goal.children.map((kr) => (
                      <div key={kr.id} className="space-y-2">
                        <span className="section-label">Key result</span>
                        <GoalRowForm
                          action={updateGoal.bind(null, kr.id)}
                          onDelete={deleteGoal.bind(null, kr.id)}
                          goal={kr}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-label">Add a goal</h2>
        <div className="card p-6">
          <AddGoalForm objectives={objectives} />
        </div>
      </section>
    </main>
  );
}
