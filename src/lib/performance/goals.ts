import type { GoalStatus, GoalType } from "@/types/database";

export type Goal = {
  id: string;
  employee_id: string;
  goal_type: GoalType;
  parent_goal_id: string | null;
  title: string;
  description: string | null;
  status: GoalStatus;
  progress: number;
  due_date: string | null;
};

export type GoalWithChildren = Goal & { children: Goal[] };

/**
 * Groups key results under their parent objective/goal and computes each
 * top-level goal's effective progress: the average of its key results' own
 * progress when it has any, otherwise its own `progress` column. Top-level
 * goals with no parent come first, in the order they were passed in.
 */
export function groupGoalsWithRollup(goals: Goal[]): (GoalWithChildren & {
  effectiveProgress: number;
})[] {
  const children = new Map<string, Goal[]>();
  for (const goal of goals) {
    if (!goal.parent_goal_id) continue;
    const list = children.get(goal.parent_goal_id) ?? [];
    list.push(goal);
    children.set(goal.parent_goal_id, list);
  }

  return goals
    .filter((goal) => !goal.parent_goal_id)
    .map((goal) => {
      const kids = children.get(goal.id) ?? [];
      const effectiveProgress =
        kids.length === 0
          ? goal.progress
          : Math.round(kids.reduce((sum, kid) => sum + kid.progress, 0) / kids.length);
      return { ...goal, children: kids, effectiveProgress };
    });
}
