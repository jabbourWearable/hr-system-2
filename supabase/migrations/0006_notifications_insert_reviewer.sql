-- HR system: allow a leave-request reviewer to create the requester's
-- notification directly (HR-14, spec §5 item 8).
--
-- 0002_rls_policies.sql originally documented (and left unimplemented) a
-- design where this insert would go through a service-role client, since
-- there was no INSERT policy for `authenticated` on `notifications` beyond
-- `notifications_admin_all`. That leaves SUPABASE_SERVICE_ROLE_KEY as a hard
-- dependency — a credential this project has never obtained (see
-- ARCHITECTURE.md's Supabase blocker history). A manager reviewing a direct
-- report's leave request already has equivalent authority via
-- `leave_requests_update_manager` (0002); this policy grants that same
-- reviewer the narrow, mirrored ability to insert one notification row for
-- that same target user, so the feature no longer depends on the
-- service-role key at all. Admins already had this via
-- `notifications_admin_all` (`for all`) — this policy is additive, scoped to
-- managers, and only lets a manager insert for their own direct reports
-- (same `is_manager_of` check as the leave_requests policy).
create policy notifications_insert_reviewer
  on public.notifications for insert
  to authenticated
  with check (public.is_manager_of(user_id) or public.is_admin());
