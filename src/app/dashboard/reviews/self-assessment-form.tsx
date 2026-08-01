"use client";

import { useActionState } from "react";
import { submitSelfAssessment, type ActionState } from "./actions";

export function SelfAssessmentForm({ reviewId }: { reviewId: string }) {
  const boundAction = submitSelfAssessment.bind(null, reviewId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="selfAssessment"
        rows={6}
        required
        placeholder="What went well this cycle? What would you like to improve?"
        className="field w-full"
      />
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Submitting…" : "Submit self-assessment"}
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
