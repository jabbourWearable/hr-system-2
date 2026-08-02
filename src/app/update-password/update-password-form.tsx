"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePassword } from "./actions";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, undefined);

  if (state && "updated" in state) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm text-accent-green">
          Password updated.
        </p>
        <Link href="/dashboard" className="btn btn-primary w-full">
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
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
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
