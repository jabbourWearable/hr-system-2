"use client";

import { useActionState } from "react";
import { deleteSite } from "./actions";

export function DeleteSiteButton({
  siteId,
  siteName,
}: {
  siteId: string;
  siteName: string;
}) {
  const deleteSiteWithId = deleteSite.bind(null, siteId);
  const [state, formAction, pending] = useActionState(deleteSiteWithId, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Delete site "${siteName}"? This can't be undone.`)) {
          event.preventDefault();
        }
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <button type="submit" disabled={pending} className="btn btn-sm btn-danger">
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.error && (
        <p role="alert" className="max-w-xs text-right text-xs text-accent-red">
          {state.error}
        </p>
      )}
    </form>
  );
}
