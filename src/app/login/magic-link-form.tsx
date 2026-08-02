"use client";

import { useActionState } from "react";
import { sendSignInLink } from "./actions";

export function MagicLinkForm() {
  const [state, formAction, pending] = useActionState(sendSignInLink, undefined);

  if (state && "sent" in state) {
    return (
      <p role="status" className="text-sm text-accent-green">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="magic-link-email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="magic-link-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="field w-full"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      <button disabled={pending} type="submit" className="btn btn-outline w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
