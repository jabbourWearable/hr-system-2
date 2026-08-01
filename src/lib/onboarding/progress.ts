import type { OnboardingTaskStatus } from "@/types/database";

export type Progress = { done: number; total: number; percent: number };

export function computeProgress(tasks: { status: OnboardingTaskStatus }[]): Progress {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
