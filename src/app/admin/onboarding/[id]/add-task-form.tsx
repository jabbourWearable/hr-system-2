"use client";

import { useActionState } from "react";
import type { ActionState } from "../actions";

type Props = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  assignees: { id: string; fullName: string }[];
};

export function AddTaskForm({ action, assignees }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="grid gap-3 p-5 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="new-title" className="text-sm font-medium text-ink">
          Title
        </label>
        <input
          id="new-title"
          name="title"
          type="text"
          placeholder="e.g. Set up payroll details"
          required
          className="field w-full"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="new-description" className="text-sm font-medium text-ink">
          Description
        </label>
        <textarea id="new-description" name="description" rows={2} className="field w-full" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="new-assignee" className="text-sm font-medium text-ink">
          Assignee
        </label>
        <select id="new-assignee" name="assigneeId" defaultValue="" className="field w-full">
          <option value="">Unassigned</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="new-due" className="text-sm font-medium text-ink">
          Due date
        </label>
        <input id="new-due" name="dueDate" type="date" className="field w-full" />
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
      <button type="submit" disabled={pending} className="btn btn-primary sm:col-span-2">
        {pending ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}
