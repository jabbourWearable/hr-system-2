-- HR-13 (leave request + approval workflow) — reviewer comment column
--
-- project-specs/hr-system-setup.md §7's leave_requests sketch has no column
-- for it, but HR-13's acceptance criteria explicitly require the
-- manager/admin to be able to "approve/reject with an optional comment".
-- No RLS changes needed: the existing leave_requests_update_manager /
-- leave_requests_admin_all policies (0002_rls_policies.sql) already permit
-- updating any column on rows a manager/admin is authorized to touch.

alter table public.leave_requests
  add column if not exists review_comment text;

comment on column public.leave_requests.review_comment is
  'Optional comment left by the manager/admin who approved or rejected this request.';
