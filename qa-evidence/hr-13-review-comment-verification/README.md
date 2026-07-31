# HR-13 — final verification of the reviewer comment column

Closes the one gap left open by HR-27's independent QA (`qa-evidence/hr-27-leave-workflow-verification/`):
migration `0005_add_leave_requests_review_comment.sql` is now applied and live (confirmed
2026-07-31, see `ARCHITECTURE.md`), so this pass runs against the real, unpatched committed code
— no local patch needed this time.

Fixtures: the same durable `hr13.admin@example.com` / `hr13.manager@example.com` /
`hr13.employee@example.com` accounts used since HR-13's original implementation (employee is a
report of the manager) — no new SQL bootstrap was needed since these accounts already held their
roles from before migration `0004` closed the self-escalation path.

1. `01`/`02` — hr13.employee submits two leave requests (one for the approve path, one for reject).
2. `03` — hr13.manager's `/dashboard/leave/approvals` shows the pending request, with a "Comment
   (optional)" textarea filled in before clicking Approve.
3. `04` — manager's queue is empty immediately after approving.
4. `05` — hr13.employee's own `/dashboard/leave` shows "Approved" **and** the manager's exact
   comment text ("Approved - team coverage confirmed for these dates.") in the "Reviewer comment"
   column — this is the value that could not be verified until now.
5. `06` — hr13.admin's `/admin/leave` (company-wide) shows the second pending request, comment
   textarea filled in before clicking Reject.
6. `07` — admin's queue is empty immediately after rejecting.
7. `08` — hr13.employee's own page shows "Rejected" and the admin's exact comment text
   ("Rejected - conflicts with quarter-end close.") persisted and rendered correctly.

Also visible in `05`/`08`: pre-existing rows from HR-13's original implementation pass and HR-27's
independent QA, all still showing "—" in the Reviewer comment column, exactly as expected since
those decisions were made before `0005` was live.

**Verdict:** the last untested acceptance-criterion fragment (approve/reject with a comment,
against the real committed schema) is now confirmed working end-to-end. Combined with HR-27's
earlier PASS on submission, RLS-scoped manager visibility, company-wide admin visibility,
approve/reject transitions, and `reviewed_by` attribution, all of HR-13's acceptance criteria are
independently verified live.
