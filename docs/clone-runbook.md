# Concierge clone runbook (Phase 1)

How to stand up a new family's instance by hand: **one Supabase project +
one Vercel project + this repo + their config**. No new architecture — this
is the Phase 1 "does it actually work / will families pay" learning loop
(see [product-roadmap.md](./product-roadmap.md)).

> **Validated 2026-06-13** end-to-end against a scratch Supabase project
> (`supabase projects create` → all 34 migrations applied from an empty DB →
> seeds, buckets, RLS all present). The findings and gotchas below are from
> that real run, not theory.

---

## 0. Before you start — what makes a clone *theirs*

A clone differs from this repo in exactly these places:

| Concern | Where it lives | Per-clone action |
|---|---|---|
| Site name, domain, admin name, hero, federation, founding letter | `config/family.ts` | Edit (Phase 0 made this one file) |
| Family lines (names, colors, photos) | `lib/family-lines.ts` + **seeded into the DB** | Replace in code **and** reseed the table (see §3) |
| Family trees / genealogy | `lib/family-trees.ts` | Replace |
| Section blurbs (voice) | `lib/sections.ts` | Edit (sections themselves are product-default) |
| Admin identity | `ADMIN_EMAIL` env + `0005_seed_admin.sql` | Set env; reseed admin (see §3) |
| All secrets/keys | Vercel env | Set per deployment (§4) |

Everything else (the 16 sections, 20 occasion types, the schema) is
product-default and carries over unchanged.

---

## 1. Supabase project

```bash
# Create the project (org id from `supabase orgs list`).
supabase projects create <family>-kitchen \
  --org-id <org-id> --region us-east-1 --db-password "<generated>"
# → note the project ref, e.g. abcdxyz...
```

**Gotcha (validated):** the direct connection (`db.<ref>.supabase.co:5432`)
is **IPv6-only**; from a typical IPv4 machine it fails with
`no route to host`. Use the **session pooler** instead — and the region
prefix is **`aws-1`**, not `aws-0`:

```
postgresql://postgres.<ref>:<pw>@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

The simplest path is to `supabase link --project-ref <ref> -p <pw>` (the CLI
resolves the right pooler URL into `supabase/.temp/pooler-url`) and then use
`--linked`. Do this in a throwaway checkout/worktree so you don't disturb
the link to production.

---

## 2. Schema — apply all migrations

```bash
supabase db push --linked -p "<pw>"     # applies 0001 … 0034 from empty
```

Validated: the full chain applies cleanly from scratch. The
`NOTICE … policy … does not exist, skipping` lines are the idempotent
`drop policy if exists` guards firing on first creation — harmless.

This also creates the storage buckets (`recipe-photos`, `family-photos`,
`contributor-photos`, `backups`, `photo-backups`) and seeds the 16 sections
and 20 occasion types.

---

## 3. Reseed the clone's own family data ⚠️

**This is the step the migrations get wrong for a clone.** `0003_seeds.sql`
seeds *Kate's* six family lines and `0005_seed_admin.sql` hard-codes
`edwards.ksh@gmail.com` as admin — so a fresh clone DB comes up with the
wrong family lines and the wrong admin.

Run the provisioning helper, which clears the inherited family lines and
reseeds from the clone's `lib/family-lines.ts`, and sets the admin from
`ADMIN_EMAIL`:

```bash
node --env-file=.env.local scripts/provision-clone-db.mjs --db-url "<pooler-url>"
```

(The admin will also be created automatically on their first magic-link
sign-in via the `auth.ts` `ADMIN_EMAIL` bootstrap — the reseed just makes
the DB correct immediately and removes Kate's row.)

> **Known cleanup (tracked):** family lines living in *both* code and the DB
> is the root cause here. The clean fix is to make `lib/family-lines.ts` the
> single source and seed the table from it (drop the hard-coded line seed in
> `0003`). Until then, §3 is mandatory for every clone.

---

## 4. Vercel project

1. Import the repo as a new Vercel project (or `vercel link` a fresh one).
2. Set environment variables (Production **and** Preview — Preview needs
   them too, see the [preview-env memory note]): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXTAUTH_SECRET` (`AUTH_SECRET`), `ADMIN_EMAIL`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, and `AUTH_TRUST_HOST=true`
   for Preview. `NEXTAUTH_URL` = the clone's production URL (Production only).
   Optional: `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` for error monitoring.
3. Crons land automatically from `vercel.json` (DB backup, orphan cleanup,
   backup watchdog, photo backup).
4. Register the deploy-failure webhook (existing pattern) if desired.

---

## 5. Auth — expose the `next_auth` schema ⚠️ (manual dashboard step)

NextAuth's Supabase adapter reads/writes the `next_auth` schema. PostgREST
must be told to expose it, or sign-in fails. In the Supabase dashboard:
**Project Settings → API → Exposed schemas** → add `next_auth`.
(Or via the management API: PATCH the PostgREST config `db_schema` to include
`next_auth`.) See the [supabase-dashboard memory note] for why this can't be
a migration.

---

## 6. Resend (email)

Magic-link sign-in and admin notifications go through Resend. Either verify
the clone's domain in Resend and set `EMAIL_FROM` to it, or use the
`onboarding@resend.dev` fallback for early testing.

---

## 7. Smoke test

- Visit the site → homepage 200, the clone's name/hero/lines show.
- Sign in with `ADMIN_EMAIL` → magic link arrives, you land as admin.
- Add a recipe (paste) → parses, saves, appears.
- `/album` loads (sign-in only).
- Trigger `/api/cron/photo-backup` once to seed the image backup.

---

## What's automated vs manual today

- **Automated:** migrations, sections/occasions seed, buckets (all via §2);
  clone family-line + admin reseed (§3 script).
- **Manual:** project creation (§1), Vercel env (§4), `next_auth` exposed
  schema (§5), Resend domain (§6). These are the candidates for a future
  one-command `provision-clone` once Phase 1 proves demand.
