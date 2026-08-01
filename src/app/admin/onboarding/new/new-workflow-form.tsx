"use client";

import { useActionState } from "react";
import type { ActionState } from "../actions";

type Props = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  employees: { id: string; fullName: string }[];
};

export function NewWorkflowForm({ action, employees }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="employeeId" className="text-sm font-medium text-ink">
          Employee
        </label>
        <select id="employeeId" name="employeeId" required className="field w-full">
          <option value="">Select an employee…</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="workflowType" className="text-sm font-medium text-ink">
          Workflow type
        </label>
        <select id="workflowType" name="workflowType" required className="field w-full">
          <option value="onboarding">Onboarding</option>
          <option value="offboarding">Offboarding</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="targetDate" className="text-sm font-medium text-ink">
          Start date / last working day
        </label>
        <input
          id="targetDate"
          name="targetDate"
          type="date"
          required
          className="field w-full"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="useTemplate"
          defaultChecked
          className="h-4 w-4 rounded border-hairline-strong"
        />
        Seed with the standard checklist
      </label>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Creating…" : "Create workflow"}
      </button>
    </form>
  );
}
