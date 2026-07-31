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
    <form action={formAction} className="space-y-2">
      <div className="space-y-1">
        <label htmlFor={`comment-${requestId}`} className="text-sm font-medium">
          Comment (optional)
        </label>
        <textarea
          id={`comment-${requestId}`}
          name="comment"
          rows={2}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Working…" : "Approve"}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-red-600 hover:bg-surface disabled:opacity-60"
        >
          {pending ? "Working…" : "Reject"}
        </button>
      </div>
      {state && "error" in state && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state && "message" in state && (
        <p role="status" className="text-sm text-green-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
