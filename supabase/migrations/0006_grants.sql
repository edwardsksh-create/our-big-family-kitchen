-- Grant service_role access to all application tables.
--
-- When tables are created via the dashboard SQL editor (instead of through
-- the Supabase CLI's auto-grants), the service_role does not get table
-- privileges by default. The Data API then returns 42501 permission denied.
--
-- We grant only to service_role for Phase 1 (server-side access only).
-- anon/authenticated grants will be added in Phase 2 along with client-side
-- access via the @supabase/ssr bridge.

grant usage on schema public to service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Future tables created in this schema automatically get grants for service_role.
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;

-- next_auth schema: the @auth/supabase-adapter reads/writes here via service_role.
grant usage on schema next_auth to service_role;
grant all on all tables    in schema next_auth to service_role;
grant all on all sequences in schema next_auth to service_role;
alter default privileges in schema next_auth grant all on tables    to service_role;
alter default privileges in schema next_auth grant all on sequences to service_role;
