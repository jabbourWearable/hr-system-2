"use client";

import { useActionState, useState } from "react";
import { createGoal, type ActionState } from "./actions";

export function AddGoalForm({ objectives }: { objectives: { id: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createGoal, undefined);
  const [goalType, setGoalType] = useState<"goal" | "objective" | "key_result">("goal");

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="goalType" className="text-sm font-medium text-ink">
          Type
        </label>
        <select
          id="goalType"
          name="goalType"
          value={goalType}
          onChange={(e) => setGoalType(e.target.value as typeof goalType)}
          className="field w-full"
        >
          <option value="goal">Goal</option>
          <option value="objective">Objective</option>
          <option value="key_result">Key result (rolls up into an objective)</option>
        </select>
      </div>

      {goalType === "key_result" && (
        <div className="space-y-1.5">
          <label htmlFor="parentGoalId" className="text-sm font-medium text-ink">
            Parent objective
          </label>
          <select id="parentGoalId" name="parentGoalId" required className="field w-full">
            <option value="">Select an objective…</option>
            {objectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium text-ink">
          Title
        </label>
        <input id="title" name="title" type="text" required className="field w-full" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium text-ink">
          Description
        </label>
        <textarea id="description" name="description" rows={2} className="field w-full" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dueDate" className="text-sm font-medium text-ink">
          Due date
        </label>
        <input id="dueDate" name="dueDate" type="date" className="field w-full" />
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Adding…" : "Add goal"}
      </button>
    </form>
  );
}
