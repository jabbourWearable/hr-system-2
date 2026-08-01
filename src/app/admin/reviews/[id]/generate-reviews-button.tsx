"use client";

import { useActionState } from "react";
import type { ActionState } from "../actions";

export function GenerateReviewsButton({
  action,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button type="submit" disabled={pending} className="btn btn-outline btn-sm">
        {pending ? "Generating…" : "Generate reviews for everyone"}
      </button>
      {state && "error" in state && (
        <span role="alert" className="text-xs text-accent-red">
          {state.error}
        </span>
      )}
      {state && "message" in state && (
        <span role="status" className="text-xs text-accent-green">
          {state.message}
        </span>
      )}
    </form>
  );
}
