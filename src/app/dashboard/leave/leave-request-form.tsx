"use client";

import { useActionState } from "react";
import { requestLeave, type LeaveRequestFormState } from "./actions";

const LEAVE_TYPE_OPTIONS = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "unpaid", label: "Unpaid" },
  { value: "other", label: "Other" },
];

export function LeaveRequestForm() {
  const [state, formAction, pending] = useActionState<LeaveRequestFormState, FormData>(
    requestLeave,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="startDate" className="text-sm font-medium text-ink">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="field w-full font-mono text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="endDate" className="text-sm font-medium text-ink">
            End date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            className="field w-full font-mono text-[13px]"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="leaveType" className="text-sm font-medium text-ink">
          Type
        </label>
        <select
          id="leaveType"
          name="leaveType"
          required
          defaultValue=""
          className="field w-full"
        >
          <option value="" disabled>
            Select a type
          </option>
          {LEAVE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="reason" className="text-sm font-medium text-ink">
          Reason
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={3}
          className="field w-full"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
