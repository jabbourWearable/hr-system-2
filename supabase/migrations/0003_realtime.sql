-- Enable Supabase Realtime (Postgres Changes) on notifications, per spec
-- §5.8 / §7: the in-app notification list updates live via Realtime.
-- RLS policies above still apply to Realtime subscriptions, so a client
-- only receives change events for rows it's allowed to SELECT.
alter publication supabase_realtime add table public.notifications;
