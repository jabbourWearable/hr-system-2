"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "./actions";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  if (state && "sent" in state) {
    return (
      <p role="status" className="text-sm text-accent-green">
        Check your email for a link to set a new password.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="email"
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
      <button disabled={pending} type="submit" className="btn btn-primary w-full">
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
