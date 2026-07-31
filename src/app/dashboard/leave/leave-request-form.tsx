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
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="endDate" className="text-sm font-medium">
            End date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="leaveType" className="text-sm font-medium">
          Type
        </label>
        <select
          id="leaveType"
          name="leaveType"
          required
          defaultValue=""
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
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
      <div className="space-y-1">
        <label htmlFor="reason" className="text-sm font-medium">
          Reason
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={3}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
