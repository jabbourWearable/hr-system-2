# HR-78 live prod verification

Ran `capture.js` (identical to `../capture.js`) against
`https://hr-system-2-iota.vercel.app` on commit `efefb9563dc4296226caaaac6be8f5964124536a`,
which `scripts/deploy-prod.sh` confirmed live via `/api/version` before this run.

**27/28 passed.** The one failure — `employee console clean`, a Minified
React error #418 attributed to `/dashboard` — is the pre-existing, already
tracked hydration-mismatch bug (backlog issue, `notifications-list.tsx:103`
rendering `toLocaleString()` server-UTC vs. browser-TZ; reproduces on prod,
not localhost, since server/browser timezones match locally). It fired when
the employee fixture was redirected to `/dashboard` after the
admin-route-redirect check, not from any HR-78 page. Same delta HR-77's own
live verification saw (20/21, "delta = pre-existing HR-82 bug, not a
regression") — see `ARCHITECTURE.md` and project memory.

All test cycle/review/goal/1:1 rows created during this run were deleted
afterward via `psql "$DATABASE_URL"` (owner connection, bypasses RLS), same
cleanup discipline as every prior live-verification pass in this project.
