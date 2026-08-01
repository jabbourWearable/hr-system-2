"use client";

import { useActionState } from "react";
import type { SiteFormState } from "./actions";

type SiteFormProps = {
  action: (
    prevState: SiteFormState,
    formData: FormData,
  ) => Promise<SiteFormState> | SiteFormState;
  defaultValues?: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  submitLabel: string;
};

// Shared by the create form (/admin/sites) and edit form
// (/admin/sites/[id]/edit) — `action` is bound to updateSite(id, ...) on the
// edit page. `defaultValues` is omitted on create so radius_meters has no
// pre-filled value, per spec §11 Q5 (no fixed default geofence radius).
export function SiteForm({ action, defaultValues, submitLabel }: SiteFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-ink">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultValues?.name}
          className="field w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="latitude" className="text-sm font-medium text-ink">
            Latitude
          </label>
          <input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            required
            defaultValue={defaultValues?.latitude}
            className="field w-full font-mono text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="longitude" className="text-sm font-medium text-ink">
            Longitude
          </label>
          <input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            required
            defaultValue={defaultValues?.longitude}
            className="field w-full font-mono text-[13px]"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="radiusMeters" className="text-sm font-medium text-ink">
          Radius (meters)
        </label>
        <input
          id="radiusMeters"
          name="radiusMeters"
          type="number"
          step="any"
          min={1}
          required
          defaultValue={defaultValues?.radiusMeters}
          placeholder="e.g. 150"
          className="field w-full font-mono text-[13px]"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-accent-red">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
