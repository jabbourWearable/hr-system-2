"use client";

import { useActionState } from "react";
import type { ActionState } from "../actions";

type Props = {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  reports: { id: string; fullName: string }[];
};

export function NewOneOnOneForm({ action, reports }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  if (reports.length === 0) {
    return <p className="text-sm text-mute">You have no direct reports yet.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="employeeId" className="text-sm font-medium text-ink">
          Direct report
        </label>
        <select id="employeeId" name="employeeId" required className="field w-full">
          <option value="">Select…</option>
          {reports.map((report) => (
            <option key={report.id} value={report.id}>
              {report.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="meetingDate" className="text-sm font-medium text-ink">
          Meeting date
        </label>
        <input id="meetingDate" name="meetingDate" type="date" required className="field w-full" />
      </div>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Scheduling…" : "Schedule"}
      </button>
    </form>
  );
}
