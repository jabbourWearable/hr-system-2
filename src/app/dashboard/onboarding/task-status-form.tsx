"use client";

import { useActionState } from "react";
import { updateMyTaskStatus } from "./actions";
import type { OnboardingTaskStatus } from "@/types/database";

// Shared by /dashboard/onboarding (own checklist + tasks assigned to you)
// and /dashboard/onboarding/team (manager view) — only rendered for a task
// the current user is the assignee of; every other task on a visible
// workflow renders as a read-only TaskStatusBadge instead (see both pages).
export function TaskStatusForm({
  taskId,
  status,
}: {
  taskId: string;
  status: OnboardingTaskStatus;
}) {
  const boundAction = updateMyTaskStatus.bind(null, taskId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        name="status"
        defaultValue={status}
        className="field !h-8 !py-1 text-xs"
        aria-label="Task status"
      >
        <option value="pending">Pending</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
      </select>
      <button type="submit" disabled={pending} className="btn btn-outline btn-sm">
        {pending ? "Saving…" : "Update"}
      </button>
      {state && "error" in state && (
        <span role="alert" className="text-xs text-accent-red">
          {state.error}
        </span>
      )}
      {state && "message" in state && (
        <span role="status" className="text-xs text-accent-green">
          {state.message}
        </span>
      )}
    </form>
  );
}
