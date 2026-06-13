# Product roadmap — from Kate's site to a product other families can buy

This is the charter for the **product track**. The reader is assumed to be
starting cold: read this, then design.md, then the code. The family site at
bigfamilykitchen.com is **production for real users** — the product track
never destabilizes it.

## The strategy (decided June 2026)

Test demand before building multi-tenancy. Three phases, each gated:

> **Status (2026-06-13):** Phase 0 ✅ done (config/family.ts, deployed). The
> full security gate ✅ done & deployed (PRs #1–#9; the 3 migrations applied
> to prod; image archive backed up; Sentry live). **Phase 1 in progress** —
> from-scratch clone provisioning validated on a scratch project; see
> docs/clone-runbook.md and §"Phase 1 findings" below.

1. **Phase 0 — per-family config extraction.** Make "which family is this?"
   a configuration concern instead of facts scattered through the code.
   Kate's family becomes the first config instance; the live site must be
   pixel-identical afterward. Safe to do now; improves the codebase
   regardless of business outcome.
2. **Phase 1 — concierge clones.** Onboard 2–5 paying families by hand:
   one Vercel project + one Supabase project + this repo + their config
   file each. No new architecture. Learn the two things code can't tell
   us: will families pay, and does each family have "their Kate" (the
   product silently assumes a devoted admin-curator per family).
3. **Phase 2 — real multi-tenancy.** Only after Phase 1 says yes.
   family_id on every table, RLS designed in from day one, Stripe,
   self-serve onboarding. A multi-week dedicated build.

## Working agreement (non-negotiable)

- **Work on `product/*` branches via PR + Vercel preview.** Kate does NOT
  gatekeep merges/deploys/migrations — the agent merges, deploys, and
  applies reviewed migrations itself (Kate 2026-06-13; the earlier
  "merged only on Kate's approval" was prior-model overcaution). PRs stay
  for reviewability, not for an approval gate. (See memory:
  autonomy-main-and-technical.)
- **Schema changes: validate before production.** Reviewed migrations are
  applied to prod by the agent (`supabase db push --linked`); experiments
  and from-scratch validation go to a scratch project first
  (`supabase projects create`, org token in .env.local). The IPv4 session
  pooler (`aws-1-...pooler`) is required for `db push`, not the IPv6 direct
  connection — see docs/clone-runbook.md.
- **Never touch production data.** Verification uses synthetic rows with
  cleanup, the forged-session pattern in `scripts/_*-verify.mjs` examples,
  or scratch projects.
- After ANY package-lock change: clean-room `npm ci` before pushing.
  `npx next build` locally before pushing non-trivial changes. sharp stays
  lazy-imported. (See memory: deploy-pipeline-gotchas — a corrupt lockfile
  once broke deploys silently for four days.)

## Phase 0 inventory — everything that is currently Kate-specific

Target shape: a `lib/tenant.ts` (or `config/family.ts`) module exporting
one typed object; everything below reads from it. Kate's values are the
only instance, checked into the repo.

**Identity & copy**
- Site name "Our Big Family Kitchen" — layout metadata, header brand,
  footer ©, email subjects/bodies, sign-in/about/thanks copy.
- Domain bigfamilykitchen.com — sitemap BASE_URL, robots, backup-route
  docs, magic-link email host display.
- "Kate" by name in user-facing copy (deliberate, warm — must become a
  config value like `adminDisplayName`): sign-in ("the email Kate
  invited"), /add/thanks ("Kate will review"), draft/pending banners
  ("only you and Kate"), comments humanError ("Only the author or Kate"),
  photo-review admin-only notice.
- Layout metadata description (lists the family line names).

**Structure (per-family data living in code)**
- `lib/family-lines.ts` — lines, colors, photos (public/families/*).
- `lib/family-trees.ts` — the genealogy. Kate-dictated; per family.
- `lib/sections.ts` — section list, colors, blurbs (blurbs are Kate's
  voice; sections themselves are arguably product-default + overridable).
- Occasion seed list (migration 0017/0019 + runtime-created) — DB-seeded,
  fine per-clone; the三 majors that had home doorways are gone.
- The Aunt Laura letter section on /about + archive links — **Kate-only
  content, hard-coded by design**; other families get their own
  equivalent or nothing (config: optional "founding letter" block).
- Federation (`FEDERATED_LINES`, leuschfamilyrecipes.com banner, footer
  link, home archive box) — Kate-only; config-optional.
- Hero fallback image + caption (public/hero/*).

**Auth & env**
- ADMIN_EMAIL bootstrap (auth.ts signIn callback) — per clone.
- Env vars are already per-deployment (Vercel) — the clone runbook just
  sets them: Supabase keys, RESEND, ADMIN_EMAIL, CRON_SECRET,
  ANTHROPIC_API_KEY, NEXTAUTH_*, VERCEL_WEBHOOK_SECRET.

**Per-clone infra (the runbook will script what it can)**
- Supabase project: run all migrations (`supabase db push --db-url`),
  seed sections/occasions, create buckets (0011/0015/0017→0026 handle
  it), set exposed schemas for next_auth (manual dashboard step — see
  memory: supabase-dashboard-sql gotchas).
- Vercel project: link repo, env vars, crons land via vercel.json,
  register the deploy-failure webhook (scripts pattern exists), Resend
  domain or onboarding fallback.

## Security gate — REQUIRED before any non-Kate family's data

> ✅ **All 8 done and deployed to production (2026-06-13)**, PRs #1–#9.
> RLS, AI caps, and the photo-backups bucket migrations are applied to prod.
> Item 8 was met by the "check errors" path (PR #4); the transactional-RPC
> upgrade is an optional follow-up.

All known, all small (they bite when the data isn't ours):

1. **RLS on post-0004 tables**: family_members, family_photos,
   family_photo_people/occasions/occasion_types/recipes, recipe_comments,
   recipe_occasions. One migration; service-role unaffected.
2. **AI spend caps**: vision hints are now OFF (June 2026); recipe
   parsing (photo/text/URL) remains uncapped per user. Add per-contributor
   daily caps.
3. **SSRF redirect re-check** in lib/recipe-from-url.ts (redirect:
   'manual' + per-hop host validation; the first-hop check exists in
   lib/url-safety.ts).
4. **Upload byte-sniffing** (sharp decode probe) instead of trusting
   client MIME, both upload routes.
5. **Runtime error monitoring** (Sentry or equivalent) — deploy failures
   and backup health are alarmed; runtime 500s are not.
6. **Storage-bucket backups** — the DB backup is solid (drift-guarded,
   restore-drilled); the image bytes have no second copy anywhere.
7. **Album pagination** before archives reach four digits
   (fetchAllReviewedPhotos is unbounded; ~300 photos today).
8. **Transactional recipe sync** — lib/recipes/save.ts syncs are
   delete-then-insert with unchecked errors; move to an RPC or at least
   check errors.

## Multi-tenant constraints to remember at Phase 2

- No family_id anywhere; ~21 tables need scoping.
- Global uniques that must become composite: contributors.email (the hard
  one — one person, two families), recipes.slug, sections.slug,
  family_lines.slug, tags.slug, invitations.email/token,
  federated_recipes.source_url, family_photos.storage_path.
- Every query in lib/queries/* is unscoped.
- The single service-role key means isolation must be BUILT (RLS-first
  design), not extended.
- Storage layout needs per-family prefixes; the signed-URL serving layer
  (familyPhotoSignedUrls) is already centralized, which helps.
- Per-photo/AI costs and storage egress become per-customer COGS — price
  accordingly.

## Current state pointers

- design.md — the binding design standard (vision + current system).
- The engineering audit and UX audit live in session history; their
  open items are folded into the security gate above.
- CI: vitest (257) + typecheck + build + Playwright (32, runs against
  prod post-deploy). Backup drift-guard tests will demand updates when
  schema changes (SCHEMA_VERSION lives in lib/backup/tables.ts and
  scripts/restore-from-backup.mjs).
- Monitoring: deploy-failure webhook → email; backup watchdog cron 12:00
  UTC; no runtime error tracking yet.

## Phase 1 findings (2026-06-13)

From standing a fresh clone DB up on a scratch project (all 34 migrations
from empty → seeds, buckets, RLS — validated):

- **The migration chain composes from scratch.** A clone DB can be built in
  one `supabase db push`. This was the big unknown (prod was built
  incrementally over months).
- **The seed migrations bake in Kate's data.** `0003_seeds.sql` seeds Kate's
  six family lines and `0005_seed_admin.sql` hard-codes her admin email — a
  clone inherits the wrong family + admin. Worked around by
  `scripts/provision-clone-db.mjs` (reseeds family_lines from
  `lib/family-lines.ts`, swaps the admin to `ADMIN_EMAIL`). See
  docs/clone-runbook.md §3.
- **Next code task — single-source family lines.** `family_lines` lives in
  both `lib/family-lines.ts` (code) and a hard-coded DB seed. Make the lib
  the single source and seed the table from it (drop the line seed in 0003),
  so a clone edits one file. This is the cleanest pre-Phase-2 cleanup.
- **Provisioning that's still manual** (runbook §4–6): Vercel project + env,
  the `next_auth` exposed-schema dashboard step, Resend. Candidates for a
  one-command provisioner once Phase 1 proves demand.
