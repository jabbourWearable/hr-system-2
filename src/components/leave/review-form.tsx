"use client";

import { useActionState } from "react";
import type { ReviewActionState } from "@/lib/leave/review";

type Props = {
  requestId: string;
  action: (
    requestId: string,
    prevState: ReviewActionState,
    formData: FormData,
  ) => Promise<ReviewActionState>;
};

// Shared by the manager approvals page (/dashboard/leave/approvals) and the
// admin leave page (/admin/leave) — `action` is bound to the caller's own
// Server Action (reviewAsManager / reviewAsAdmin) so each page keeps its own
// requireRole() guard. Two submit buttons share one <form> and one comment
// textarea; only the clicked button's name="decision" value="..." pair is
// included in the submitted FormData, so a single bound action can tell
// approve from reject.
export function ReviewForm({ requestId, action }: Props) {
  const boundAction = action.bind(null, requestId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`comment-${requestId}`} className="text-sm font-medium text-ink">
          Comment (optional)
        </label>
        <textarea
          id={`comment-${requestId}`}
          name="comment"
          rows={2}
          className="field w-full"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Working…" : "Approve"}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className="btn btn-danger"
        >
          {pending ? "Working…" : "Reject"}
        </button>
      </div>
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
