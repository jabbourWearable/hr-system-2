"use client";

import { useActionState } from "react";
import type { ActionState } from "../actions";

type Props = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
};

export function NewCycleForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-ink">
          Cycle name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Q1 2026 Performance Review"
          className="field w-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="startDate" className="text-sm font-medium text-ink">
            Start date
          </label>
          <input id="startDate" name="startDate" type="date" className="field w-full" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="endDate" className="text-sm font-medium text-ink">
            End date
          </label>
          <input id="endDate" name="endDate" type="date" className="field w-full" />
        </div>
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creating…" : "Create cycle"}
      </button>
    </form>
  );
}
