"use client";

import { useState, useTransition } from "react";
import { checkIn, checkOut } from "./attendance-actions";

type Props = {
  hasSite: boolean;
  siteName: string | null;
  initialIsCheckedIn: boolean;
};

type Message = { type: "error" | "success"; text: string };

export function CheckInOut({ hasSite, siteName, initialIsCheckedIn }: Props) {
  const [isCheckedIn, setIsCheckedIn] = useState(initialIsCheckedIn);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setMessage(null);

    if (!("geolocation" in navigator)) {
      setMessage({
        type: "error",
        text: "Geolocation isn't available in this browser.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const action = isCheckedIn ? checkOut : checkIn;

        startTransition(async () => {
          const result = await action(latitude, longitude);
          if ("error" in result) {
            setMessage({ type: "error", text: result.error });
            return;
          }
          setIsCheckedIn(!isCheckedIn);
          setMessage({ type: "success", text: result.message });
        });
      },
      (geoError) => {
        setMessage({
          type: "error",
          text:
            geoError.code === geoError.PERMISSION_DENIED
              ? "Location permission denied — allow location access to check in/out."
              : "Couldn't get your location. Please try again.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (!hasSite) {
    return (
      <p className="text-sm text-foreground-muted">
        No work site assigned — contact your admin.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {siteName && (
        <p className="text-sm text-foreground-muted">
          Assigned site: <span className="font-medium text-foreground">{siteName}</span>
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Working…" : isCheckedIn ? "Check Out" : "Check In"}
      </button>
      {message && (
        <p
          role="alert"
          className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-600"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
