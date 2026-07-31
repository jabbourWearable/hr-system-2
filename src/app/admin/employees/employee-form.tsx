"use client";

import { useActionState } from "react";
import type { EmployeeFormState } from "./actions";
import type { Role } from "@/types/database";

type Props = {
  action: (
    prevState: EmployeeFormState,
    formData: FormData,
  ) => Promise<EmployeeFormState>;
  managers: { id: string; fullName: string }[];
  sites: { id: string; name: string }[];
  defaultValues: { role: Role; managerId: string | null; siteId: string | null };
  submitLabel: string;
};

// `managers` is the full profiles list minus the employee being edited (a
// profile can't be its own manager — also enforced server-side in
// updateEmployeeProfile). Neither dropdown restricts by role: task list
// Task 19 says "pick from existing profiles" / "existing sites" with no
// further narrowing.
export function EmployeeForm({
  action,
  managers,
  sites,
  defaultValues,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="role" className="text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue={defaultValues.role}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="managerId" className="text-sm font-medium">
          Manager
        </label>
        <select
          id="managerId"
          name="managerId"
          defaultValue={defaultValues.managerId ?? ""}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.fullName}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="siteId" className="text-sm font-medium">
          Work site
        </label>
        <select
          id="siteId"
          name="siteId"
          defaultValue={defaultValues.siteId ?? ""}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
