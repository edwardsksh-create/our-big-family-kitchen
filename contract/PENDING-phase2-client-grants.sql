-- ⛔ PENDING — do not drop into supabase/migrations/ until the DB drift is resolved.
--
-- WHY THIS IS PARKED HERE
-- The mobile bridge authenticates clients as the Postgres `authenticated` role,
-- but 0006_grants.sql granted table privileges to `service_role` ONLY and
-- deferred anon/authenticated grants to "Phase 2". Without these grants every
-- client read/write returns 42501 "permission denied" before RLS even runs.
-- (Verified live: a correctly-signed bridge token gets 403 / 42501 on
--  GET /rest/v1/recipes — the signature is accepted, the grant is missing.)
--
-- This migration is the fix. It is NOT yet applied because `supabase migration
-- list` shows the remote database is at 0036 while the repo stops at
-- 0031_can_edit_photos.sql — migrations 0032–0036 are applied remotely but have
-- no files in the repo. That drift must be reconciled first (e.g. `supabase db
-- pull`, or locating the branch that holds 0032–0036), otherwise the migration
-- history is ambiguous and renumbering this file is guesswork.
--
-- TO APPLY (after reconciliation):
--   1. Reconcile so local migrations match remote (db pull / merge the missing files).
--   2. Rename this to the next free number, e.g. 0037_phase2_client_grants.sql,
--      and move it into supabase/migrations/.
--   3. `supabase db push`.
--   4. Re-run the bridge smoke test — GET /rest/v1/recipes with a bridge token
--      should return 200.
--
-- SCOPE: grants to `authenticated` only (every mobile request is signed in).
-- `anon` gets nothing — public web pages still render server-side via the
-- service role, and some read policies are written for signed-in family.
-- Listed EXPLICITLY (not "all tables") so the album/family-photo tables,
-- recipe_comments, recipe_occasions, and family_members — which currently have
-- NO RLS — are deliberately excluded. They need their own Phase 2b migration
-- that ENABLES RLS + writes policies BEFORE any client grant (family_photos
-- carries a public/private flag; granting it ungated would expose private
-- photos).

grant usage on schema public to authenticated;

-- Tables that already have RLS enabled + policies (0004_rls.sql). RLS is the
-- fine-grained gate; these coarse grants just let PostgREST reach the table.
grant select, insert, update, delete on public.recipes                  to authenticated;
grant select, insert, update, delete on public.ingredients              to authenticated;
grant select, insert, update, delete on public.instructions             to authenticated;
grant select, insert, update, delete on public.recipe_tags              to authenticated;
grant select, insert, update, delete on public.tags                     to authenticated;
grant select, insert, update, delete on public.photos                   to authenticated;
grant select, insert, update, delete on public.sections                 to authenticated;
grant select, insert, update, delete on public.family_lines             to authenticated;
grant select, insert, update, delete on public.contributors             to authenticated;
grant select, insert, update, delete on public.contributor_family_lines to authenticated;
grant select, insert, update, delete on public.comments                 to authenticated;
grant select, insert, update, delete on public.federated_recipes        to authenticated;
grant select, insert, update, delete on public.invitations              to authenticated;
grant select, insert, update, delete on public.submissions              to authenticated;
