"use client";

import { useActionState, useEffect, useRef } from "react";
import { giveKudos, type KudosFormState } from "./actions";

export function KudosForm({
  colleagues,
  categories,
}: {
  colleagues: { id: string; fullName: string }[];
  categories: readonly string[];
}) {
  const [state, formAction, pending] = useActionState<KudosFormState, FormData>(
    giveKudos,
    undefined,
  );

  const formRef = useRef<HTMLFormElement>(null);
  // Clear the form after a successful submit. A submit is "successful" when a
  // pending → not-pending transition lands with no error in state.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && state === undefined) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="card space-y-4 p-6">
      <h2 className="section-label">Give kudos</h2>
      <div className="space-y-1.5">
        <label htmlFor="recipientId" className="text-sm font-medium text-ink">
          Colleague
        </label>
        <select
          id="recipientId"
          name="recipientId"
          required
          defaultValue=""
          className="field w-full"
        >
          <option value="" disabled>
            Select a colleague…
          </option>
          {colleagues.map((colleague) => (
            <option key={colleague.id} value={colleague.id}>
              {colleague.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="category" className="text-sm font-medium text-ink">
          Category
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue=""
          className="field w-full"
        >
          <option value="" disabled>
            Select a category…
          </option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="message" className="text-sm font-medium text-ink">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={3}
          maxLength={500}
          placeholder="What did they do well?"
          className="field w-full"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Sending…" : "Give kudos"}
      </button>
    </form>
  );
}
