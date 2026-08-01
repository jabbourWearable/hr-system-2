"use client";

import { useActionState } from "react";
import { saveOneOnOneNote, type ActionState } from "./actions";
import type { OneOnOneNoteVisibility } from "@/types/database";

export function NoteForm({
  oneOnOneId,
  visibility,
  initialBody,
  placeholder,
}: {
  oneOnOneId: string;
  visibility: OneOnOneNoteVisibility;
  initialBody: string;
  placeholder: string;
}) {
  const boundAction = saveOneOnOneNote.bind(null, oneOnOneId, visibility);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="body"
        rows={5}
        defaultValue={initialBody}
        placeholder={placeholder}
        className="field w-full"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-outline btn-sm">
          {pending ? "Saving…" : "Save"}
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
      </div>
    </form>
  );
}
