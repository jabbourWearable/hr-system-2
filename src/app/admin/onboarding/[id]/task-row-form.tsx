"use client";

import { useActionState } from "react";
import type { ActionState } from "../actions";
import type { OnboardingTaskStatus } from "@/types/database";

type Props = {
  action: (
    prevState: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  onDelete: () => Promise<void>;
  assignees: { id: string; fullName: string }[];
  task: {
    id: string;
    title: string;
    description: string | null;
    assignee_id: string | null;
    due_date: string | null;
    status: OnboardingTaskStatus;
  };
};

// One inline edit form per task row on the admin workflow detail page
// (/admin/onboarding/[id]) — same per-row useActionState shape as
// src/components/leave/review-form.tsx, just with more editable fields
// since an admin can retitle/reassign/reschedule any task, not only decide
// approve/reject.
export function TaskRowForm({ action, onDelete, assignees, task }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid gap-3 p-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={`title-${task.id}`} className="text-sm font-medium text-ink">
          Title
        </label>
        <input
          id={`title-${task.id}`}
          name="title"
          type="text"
          defaultValue={task.title}
          required
          className="field w-full"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={`description-${task.id}`} className="text-sm font-medium text-ink">
          Description
        </label>
        <textarea
          id={`description-${task.id}`}
          name="description"
          rows={2}
          defaultValue={task.description ?? ""}
          className="field w-full"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`assignee-${task.id}`} className="text-sm font-medium text-ink">
          Assignee
        </label>
        <select
          id={`assignee-${task.id}`}
          name="assigneeId"
          defaultValue={task.assignee_id ?? ""}
          className="field w-full"
        >
          <option value="">Unassigned</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`due-${task.id}`} className="text-sm font-medium text-ink">
          Due date
        </label>
        <input
          id={`due-${task.id}`}
          name="dueDate"
          type="date"
          defaultValue={task.due_date ?? ""}
          className="field w-full"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`status-${task.id}`} className="text-sm font-medium text-ink">
          Status
        </label>
        <select
          id={`status-${task.id}`}
          name="status"
          defaultValue={task.status}
          className="field w-full"
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div className="flex items-end gap-3">
        <button type="submit" disabled={pending} className="btn btn-outline btn-sm">
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => onDelete()}
          className="btn btn-danger btn-sm"
        >
          Delete
        </button>
      </div>
      {state && "error" in state && (
        <p role="alert" className="text-sm text-accent-red sm:col-span-2">
          {state.error}
        </p>
      )}
      {state && "message" in state && (
        <p role="status" className="text-sm text-accent-green sm:col-span-2">
          {state.message}
        </p>
      )}
    </form>
  );
}
