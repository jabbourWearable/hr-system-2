"use client";

import { useActionState } from "react";
import type { ActionState } from "./actions";
import type { GoalStatus } from "@/types/database";

type Props = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  onDelete: () => Promise<void>;
  goal: {
    id: string;
    title: string;
    description: string | null;
    status: GoalStatus;
    progress: number;
    due_date: string | null;
  };
};

// Inline edit form for one goal/objective/key-result row on
// /dashboard/goals — same per-row useActionState shape as
// src/app/admin/onboarding/[id]/task-row-form.tsx.
export function GoalRowForm({ action, onDelete, goal }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={`title-${goal.id}`} className="text-sm font-medium text-ink">
          Title
        </label>
        <input
          id={`title-${goal.id}`}
          name="title"
          type="text"
          defaultValue={goal.title}
          required
          className="field w-full"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={`description-${goal.id}`} className="text-sm font-medium text-ink">
          Description
        </label>
        <textarea
          id={`description-${goal.id}`}
          name="description"
          rows={2}
          defaultValue={goal.description ?? ""}
          className="field w-full"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`due-${goal.id}`} className="text-sm font-medium text-ink">
          Due date
        </label>
        <input
          id={`due-${goal.id}`}
          name="dueDate"
          type="date"
          defaultValue={goal.due_date ?? ""}
          className="field w-full"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`status-${goal.id}`} className="text-sm font-medium text-ink">
          Status
        </label>
        <select
          id={`status-${goal.id}`}
          name="status"
          defaultValue={goal.status}
          className="field w-full"
        >
          <option value="not_started">Not started</option>
          <option value="on_track">On track</option>
          <option value="at_risk">At risk</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={`progress-${goal.id}`} className="text-sm font-medium text-ink">
          Progress ({goal.progress}%)
        </label>
        <input
          id={`progress-${goal.id}`}
          name="progress"
          type="range"
          min={0}
          max={100}
          step={5}
          defaultValue={goal.progress}
          className="w-full"
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-outline btn-sm">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => onDelete()} className="btn btn-danger btn-sm">
          Delete
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
      </div>
    </form>
  );
}
