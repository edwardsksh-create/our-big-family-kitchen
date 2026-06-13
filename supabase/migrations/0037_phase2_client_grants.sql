-- Phase 2: client-side table grants for the `authenticated` role.
--
-- 0006_grants.sql granted public-schema privileges to `service_role` only and
-- explicitly deferred anon/authenticated grants to "Phase 2 ... client-side
-- access via the bridge". The mobile companion apps are that Phase 2: they
-- connect as `authenticated` through the NextAuth → Supabase JWT bridge
-- (app/api/v1/auth/token). Without base table privileges PostgREST returns
-- 42501 "permission denied" before RLS ever runs. (Verified: a correctly-signed
-- bridge token got 403/42501 on /rest/v1/recipes — authenticated, but ungranted.)
--
-- SAFE TO GRANT BROADLY NOW: as of 0032_rls_family_tables.sql every table in
-- schema public has RLS enabled with policies. RLS is the fine-grained gate;
-- these grants only let PostgREST reach the tables. A DML grant on a table whose
-- RLS has no matching policy for the role is still denied by RLS.
--
-- `authenticated` ONLY. `anon` gets nothing: public web pages render server-side
-- via the service role, and the read policies are written `to authenticated`
-- (signed-in family), not the open internet.
--
-- NOTE: this grants on tables that exist *now* and deliberately does NOT set
-- `alter default privileges ... to authenticated`. Future tables get no client
-- access automatically — they must opt in (enable RLS + add a grant), so a
-- table shipped without RLS can never be silently exposed to signed-in clients.
-- (This project has shipped tables without RLS before — see the 0004→0032 gap.)
-- next_auth lives in its own schema and is untouched here (service_role only).

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Functions clients legitimately call (e.g. the recipe child-sync RPC from
-- 0035, the RLS helpers). SECURITY DEFINER bodies still run their own checks.
grant execute on all functions in schema public to authenticated;
