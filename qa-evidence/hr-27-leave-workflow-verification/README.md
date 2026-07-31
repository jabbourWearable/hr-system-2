# HR-27 — independent QA re-verification of HR-13

Independent pass against the live Supabase project (`xrbdqazyhbjmwhilfmkj`), separate from
the implementing agent's own evidence in `qa-evidence/hr-13-leave-workflow/`. Same temporary
local patch technique (review_comment column references stripped from
`src/app/dashboard/leave/page.tsx` and `src/lib/leave/review.ts`, reverted before committing —
not present in the committed code) since migration `0005` is still not applied live.

Fixtures: reused `hr13.admin@example.com` / `hr13.manager@example.com` / `hr13.employee@example.com`
(employee is a report of manager), plus a freshly created, independent `hr27qa.employee@example.com`
with `manager_id = null` — i.e. **not** a report of `hr13.manager` — created specifically for this
QA pass to test RLS scoping with an account the implementing agent never touched.

1. `01`/`02` — hr13.employee submits a new leave request ("request A"), pending badge appears.
2. `03` — the fresh, unmanaged hr27qa.employee submits its own request ("request B").
3. `04` — hr13.manager's `/dashboard/leave/approvals`: shows request A only. Request B (not a
   report) is correctly absent — confirms RLS scoping (`is_manager_of()`), not an app-level filter.
4. `05` — hr13.admin's `/admin/leave`: shows **both** request A and B — confirms company-wide
   scope via `leave_requests_admin_all`, unrestricted by any manager relationship.
5. `06` — after hr13.manager approves request A, manager's queue is empty.
6. `07` — hr13.admin rejects request B (a request that was never in hr13.manager's queue) —
   captured mid-submission ("Working…"); final state confirmed in `08`/`09` and via a direct
   REST read (`reviewed_by` resolved to each reviewer's own profile id — manager on request A,
   admin on request B).
7. `08`/`09` — each employee's own page shows the final status: request A "Approved", request B
   "Rejected".

**Not tested (categorically impossible right now, same for anyone):** the `review_comment` value
itself. The patch used to get past the missing column only *removes* the column reference — it
cannot make the column exist, so no comment text can be persisted or read back until migration
`0005` is actually applied to the live project.
