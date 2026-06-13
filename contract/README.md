# Our Big Family Kitchen — Mobile/Client Contract

This folder is the **stable interface** between the web product (this repo) and the
companion native apps (iOS / iPadOS / Android, in their own repo). The web UI can
change however it likes; everything described here is what mobile depends on, and
changes here are deliberate and announced.

> **What the apps are:** a native experience over the same cookbook + photo-album data
> the web exposes — browse/read recipes and the album, comment, contribute recipes and
> photos, under the same magic-link auth and access model. The native-first wins are
> camera capture (recipe cards → the OCR pipeline), offline reading, and push. The full
> scope and the still-open product decisions live in `contract/mobile-CLAUDE.md`.

> **Source of truth.** The product's real backend is the **Supabase Postgres
> schema + the RLS policies** in `supabase/migrations/`. Not the Next.js app — that's
> just one client. Mobile is another client of the same backend. When the schema
> changes, regenerate types (below) and everyone stays honest.

---

## 1. How a client talks to the backend

```
┌─────────────┐   magic-link sign-in (NextAuth, in an in-app browser)
│  Mobile app │ ───────────────────────────────────────────────►  web app
│             │                                                    sets session
│             │   GET /api/v1/auth/token   (with that session)
│             │ ◄──────────────────────────────────────────────  { accessToken, ... }
│             │
│  Supabase   │   supabase-swift / supabase-kt / supabase-js
│  SDK        │ ───────────────────────────────────────────────►  Supabase
└─────────────┘   reads/writes governed by RLS, as the signed-in contributor
```

The web app stays on **NextAuth** (database sessions, Resend magic links). It does
**not** issue passwords or its own API for data. Instead it hands out a short-lived
**Supabase JWT** that the native Supabase SDKs understand. After that, the app talks
to Supabase **directly** — Postgres, Storage, Realtime — and RLS enforces exactly the
same access model the web app has.

### Auth, step by step

1. **Sign in.** Open the hosted sign-in page in an in-app/system browser:
   `https://<web-host>/sign-in`. The user enters their email, taps the magic link,
   and a NextAuth session cookie is established in that browser session. (Only
   already-invited contributors can sign in — same gate as web.)
2. **Get a Supabase token.** Call `GET /api/v1/auth/token` from that authenticated
   context. Response:
   ```json
   {
     "accessToken": "<JWT>",
     "tokenType": "bearer",
     "expiresIn": 3600,
     "expiresAt": "2026-06-13T17:00:00.000Z",
     "supabaseUrl": "https://<ref>.supabase.co",
     "supabaseAnonKey": "sb_publishable_…"
   }
   ```
3. **Construct the Supabase client** with `supabaseUrl` + `supabaseAnonKey`, then set
   the session's access token to `accessToken`. (In supabase-js:
   `supabase.auth.setSession({ access_token, refresh_token: '' })` or pass it as the
   `Authorization: Bearer` global header; the native SDKs have equivalents.)
4. **Refresh.** The token lasts 1 hour. Before it expires, call
   `GET /api/v1/auth/token` again (the NextAuth session lives much longer) and swap in
   the new token. There's no separate refresh-token grant — the NextAuth session *is*
   the refresh credential.

> The token carries `email`, `role: authenticated`, `sub: <contributorId>`, and
> `app_role` (`admin` | `contributor`). RLS resolves the current contributor from the
> `email` claim — see `public.current_contributor_id()` / `public.is_admin()` in
> `supabase/migrations/0004_rls.sql`.

**`/api/v1/*` is the versioned, stable surface.** If a change would break existing
mobile clients, it goes in `/api/v2/*` — the v1 contract is never edited out from
under a shipped app.

> ✅ **Status: live.** The bridge is verified end-to-end — Supabase accepts the minted
> token and authenticates you as the `authenticated` role — and the **Phase 2 client
> grants are applied** (`0037_phase2_client_grants.sql`), so signed-in clients can read
> and write every table, gated by RLS. All tables (including the album/family-photo set,
> which got RLS in `0032_rls_family_tables.sql`) are reachable. If you ever see a `403 /
> Postgres 42501`, it means a *new* table shipped without a client grant — by design,
> new tables are locked to `authenticated` until a migration enables RLS and grants
> access (see the note at the top of `0037`).

---

## 2. The access model (what a client can see/do)

RLS is the canonical definition (`supabase/migrations/0004_rls.sql` and later photo
migrations). The shape:

| Area | Anonymous / guest | Contributor | Admin |
|---|---|---|---|
| **Published recipes** (+ ingredients, instructions, tags, photos) | read | read | read |
| **Unpublished/draft recipes** | — | own only | all |
| **Recipe writes** | — | insert own, edit own | edit/delete any |
| **Comments** | read (on published) | read + add + edit/delete own | moderate all |
| **Family lines / sections / tags** | read | read (+ add tags) | structural writes |
| **Contributors** | read profiles | read all, edit self | invite/remove |
| **Family photos** | per-photo public/private flag | own + family-line scope | all |
| **Submissions / invitations / federation** | — | — | full |

Two cross-cutting rules to know:

- **Ownership inheritance**: child rows (ingredients, instructions, recipe_tags,
  photos) inherit their parent recipe's visibility — you don't re-check them
  separately.
- **Guest accounts**: view-only access shared via `/invite` links. They sign in the
  same way and simply land with read-only RLS. (See the access-model notes in the web
  repo.)

Build the app assuming RLS will reject anything out of scope — don't reimplement these
rules client-side as security, only as UI hints.

---

## 3. Storage

Photos live in Supabase Storage (`photos` bucket; `backups` is server-only). Read
access mirrors recipe/photo RLS. Uploads from mobile can either go direct to Storage
(governed by Storage policies) or through the web app's existing upload endpoints —
prefer direct-to-Storage for native and let RLS gate it.

---

## 4. The typed schema (keep this in sync)

`types/supabase.ts` (in the web repo root) is generated from the live schema:

```bash
npm run gen:types     # supabase gen types typescript --linked > types/supabase.ts
```

This is the **shared artifact**. Two ways to consume it from the mobile repo:

- **React Native / Expo:** import the generated `Database` type directly (git
  submodule this repo, or copy `types/supabase.ts` on each schema change). supabase-js
  is fully typed off it.
- **Native Swift / Kotlin:** use it as the reference for your model structs/data
  classes. (Optionally generate Swift/Kotlin from the DB with a Postgres→type tool;
  the migrations remain the source of truth either way.)

**The sync rule:** any migration that changes a table mobile reads → run
`npm run gen:types`, commit it, and the mobile repo picks it up. Additive changes are
safe; a breaking change (renamed/removed column, tightened RLS) gets coordinated
between the two repos before it ships.

---

## 5. Quick reference

| Thing | Value |
|---|---|
| Web host (prod) | `https://ourbigfamilykitchen.com` *(confirm)* |
| Token endpoint | `GET /api/v1/auth/token` |
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` (returned by the token endpoint) |
| Supabase anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (returned by the token endpoint) |
| Token TTL | 1 hour (re-fetch to refresh) |
| Generated types | `types/supabase.ts` |
| RLS / access model | `supabase/migrations/0004_rls.sql` (+ `00xx_family_photos_*`) |
