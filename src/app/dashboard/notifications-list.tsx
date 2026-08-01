"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead } from "./notifications-actions";

export type NotificationRow = {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type Props = {
  userId: string;
  initialNotifications: NotificationRow[];
};

// This text is rendered on the server (Vercel, UTC) and again during client
// hydration (user's locale/timezone), so it must be byte-identical in both —
// a bare toLocaleString() differs per environment and logs a React #418
// hydration error on every row (HR-82). Explicit locale + UTC pins the
// output; h23 avoids the AM/PM separator, which varies across ICU versions.
function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  });
}

// Spec §5 item 8 / HR-14: in-app notification list, updated live via
// Supabase Realtime — no push/FCM/APNs (§6). RLS (notifications_select_own,
// 0002_rls_policies.sql) already scopes Postgres Changes events to the
// caller's own rows, same as any other query; the `filter` below just saves
// the client from receiving events it would have to discard anyway.
export function NotificationsList({ userId, initialNotifications }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // supabase-js only forwards the user's JWT to the Realtime websocket
    // once auth state finishes loading (createBrowserClient hydrates the
    // session from cookies asynchronously) — subscribing before that
    // resolves joins the channel unauthenticated, so RLS (auth.uid()) never
    // matches and every event is silently dropped. Awaiting getSession() and
    // explicitly calling realtime.setAuth() first avoids that race.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as NotificationRow;
            setNotifications((prev) => [row, ...prev]);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  function handleMarkRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setPendingId(id);
    startTransition(async () => {
      await markNotificationRead(id);
      setPendingId(null);
    });
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <section className="max-w-md space-y-3">
      <h2 className="section-label">
        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
      </h2>
      {notifications.length === 0 ? (
        <p className="text-sm text-mute">No notifications yet.</p>
      ) : (
        <ul className="card divide-y divide-hairline overflow-hidden text-sm">
          {notifications.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="space-y-0.5">
                <p className={n.is_read ? "text-mute" : "font-medium text-ink"}>
                  {!n.is_read && (
                    <span
                      aria-hidden
                      className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent-green align-middle"
                    />
                  )}
                  {n.message}
                </p>
                <p className="font-mono text-xs text-ash">
                  {formatTimestamp(n.created_at)}
                </p>
              </div>
              {!n.is_read && (
                <button
                  type="button"
                  disabled={pendingId === n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className="btn btn-sm btn-outline shrink-0"
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
