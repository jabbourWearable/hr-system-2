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
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-surface disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.error && (
        <p role="alert" className="max-w-xs text-right text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
