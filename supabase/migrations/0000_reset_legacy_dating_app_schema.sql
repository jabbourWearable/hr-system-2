-- Reset: this Supabase project (xrbdqazyhbjmwhilfmkj) previously hosted an
-- unrelated dating-app schema. Confirmed on HR-9 (2026-07-31) by the project
-- owner as safe to drop: "This db was used before and its used for dating
-- app I want from you to clear this db and create the new migration."
--
-- Run this FIRST, before 0001_initial_schema.sql, and only against this
-- specific project. Read-only REST probes (anon key, no writes) confirmed
-- these six tables exist; every other guessed name 404'd, so this list is
-- the full legacy schema, not a partial guess.
--
-- cascade drops dependent objects (FKs, policies, triggers) automatically,
-- so table order below doesn't matter for correctness — listed
-- children-before-parents for readability.

drop table if exists public.messages cascade;
drop table if exists public.matches cascade;
drop table if exists public.likes cascade;
drop table if exists public.blocks cascade;
drop table if exists public.reports cascade;
drop table if exists public.profiles cascade;
