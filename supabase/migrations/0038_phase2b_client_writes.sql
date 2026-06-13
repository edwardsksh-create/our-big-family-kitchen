-- Phase 2b: tighten function grants + let clients upload scans.
--
-- ── Function grants (security fix) ───────────────────────────────────────
-- 0037 granted EXECUTE on ALL public functions to `authenticated` to unblock
-- client reads. That was too broad: it also exposed SECURITY DEFINER functions
-- that trust their arguments and were only ever meant to be called by the
-- service role —
--   • reserve_ai_parse / release_ai_parse  → a client could grant itself
--     unlimited AI parses or refund/grief others' slots;
--   • replace_recipe_children              → no ownership check; a client could
--     overwrite ANY recipe's ingredients/instructions/photos;
--   • rls_auto_enable                      → maintenance function, never client-callable.
-- Revoke the blanket grant and re-grant ONLY the two read-only helpers that RLS
-- policies need to evaluate for the authenticated role. Write paths stay
-- service-role-only behind /api/v1 endpoints (which check ownership in TS and
-- resolve the "smart" parts — slugify/validation — so logic never drifts).

revoke execute on all functions in schema public from authenticated;

grant execute on function public.current_contributor_id() to authenticated;
grant execute on function public.is_admin()                to authenticated;

-- ── Client scan uploads ──────────────────────────────────────────────────
-- The recipe-card scan (native headline feature) uploads the captured image to
-- the public-read recipe-photos bucket, then POSTs its public URL to
-- /api/v1/photos/parse. Allow an authenticated client to write ONLY under its
-- own folder: mobile/<contributorId>/<uuid>.<ext>. Reads already work (the
-- bucket's world-readable SELECT policy from 0011). No client UPDATE/DELETE —
-- re-scans write a new object.
--
-- Path note for the multi-tenant future: family scoping lives on the DB rows
-- (photos/recipes gain family_id), NOT on the storage path — so this
-- contributor-keyed convention does not need a family prefix later.
create policy "recipe-photos authenticated scan upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and (storage.foldername(name))[1] = 'mobile'
    and (storage.foldername(name))[2] = public.current_contributor_id()::text
  );
