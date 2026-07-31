# HR-14 — manager-path notification, live verification (migration 0006)

Closes the one gap HR-39 left as BLOCKED: the admin notification path was
verified PASS, but the manager path depended on
`supabase/migrations/0006_notifications_insert_reviewer.sql`, which had not
yet been applied to the live project. It has now been applied (confirmed
directly, not by trusting the "done" comment — see HR-14 comment history).

## What this proves

Two independent, real browser sessions (Playwright, `run.js` in this
folder) against a live `next dev` server + the real Supabase project:

1. `hr13.employee@example.com` submits a fresh leave request and leaves
   `/dashboard` open (`01-employee-dashboard-before.png`).
2. `hr13.manager@example.com` (a different session) opens
   `/dashboard/leave/approvals`, finds that exact request
   (`02-manager-approvals-before-decision.png`), fills a comment, and clicks
   **Approve**. The row disappears from the pending list
   (`03-manager-approvals-after-decision.png`) — the real success signal
   here, since `reviewAsManager`'s `revalidatePath` removes the row in the
   same transition the inline confirmation text would have appeared in.
3. Back on the employee's **already-open** dashboard tab — no reload,
   no navigation — the new notification appears at the top of the list via
   Supabase Realtime (`04-employee-dashboard-realtime-notification.png`).
4. The employee clicks **Mark read**; the unread count drops and the row
   changes style (`05-employee-notification-marked-read.png`), covering the
   third acceptance criterion.

This exercises `src/lib/leave/review.ts`'s actual `.from("notifications").insert({...})`
call with no `.select()` chained — the real code path — not a synthetic
REST probe.

## Debugging note worth keeping

Earlier probes in this thread (`Prefer: return=representation`, i.e.
Supabase's `.insert().select()`) kept showing `403 42501` for the manager
path even after 0006 was live, which looked like the migration still hadn't
landed. It had. Postgres RLS separately enforces SELECT-policy visibility on
the `RETURNING` row for `INSERT ... RETURNING`, and there is no policy
letting a manager read a notification row that belongs to someone else —
only `notifications_select_own` / `notifications_admin_all` cover reads. The
real app code never requests `RETURNING` on this insert (no `.select()`), so
`Prefer: return=minimal` is used and this restriction never applies. Confirmed
via a direct Postgres session (`set local role authenticated; set local
request.jwt.claims ...`) that the identical `INSERT` succeeds without
`RETURNING` and fails only with it. If a future feature in this codebase
needs a privileged actor to insert a row on someone else's behalf, don't
add a matching SELECT policy just to make `RETURNING` work unless the
feature actually needs to read that row back — the app here doesn't.
