"use client";

import { useActionState } from "react";
import { submitManagerAssessment, type ActionState } from "./actions";

export function ManagerAssessmentForm({ reviewId }: { reviewId: string }) {
  const boundAction = submitManagerAssessment.bind(null, reviewId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="managerAssessment"
        rows={6}
        required
        placeholder="Assessment of this employee's performance this cycle."
        className="field w-full"
      />
      <div className="space-y-1.5">
        <label htmlFor="rating" className="text-sm font-medium text-ink">
          Rating
        </label>
        <select id="rating" name="rating" required className="field w-full max-w-[10rem]">
          <option value="">Select…</option>
          <option value="1">1 – Needs improvement</option>
          <option value="2">2 – Below expectations</option>
          <option value="3">3 – Meets expectations</option>
          <option value="4">4 – Exceeds expectations</option>
          <option value="5">5 – Outstanding</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Submitting…" : "Complete review"}
      </button>
      {state && "error" in state && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      {state && "message" in state && (
        <p role="status" className="text-sm text-accent-green">
          {state.message}
        </p>
      )}
    </form>
  );
}
