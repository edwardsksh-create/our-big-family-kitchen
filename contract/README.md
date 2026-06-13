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

### Native sign-in (magic link → deep link → token)

Magic links don't compose with an in-app web session (the email link opens the system
browser, not your web view), so the app **does not** rely on `ASWebAuthenticationSession`
completing the flow. Instead there's a deep-link bridge:

1. **Generate PKCE** in the app: a random `code_verifier`, and
   `code_challenge = base64url(SHA256(code_verifier))` (S256).
2. **Open sign-in** in the system browser (or `SFSafariViewController`):
   ```
   https://our-big-family-kitchen.vercel.app/sign-in?callbackUrl=
     %2Fapi%2Fv1%2Fauth%2Fmobile-callback%3Fcode_challenge%3D<challenge>
   ```
   (i.e. `callbackUrl` = `/api/v1/auth/mobile-callback?code_challenge=<challenge>`,
   URL-encoded). The user enters their invited email; the magic link is emailed.
3. **User taps the magic link** (in Mail → opens the browser). NextAuth verifies it,
   creates the session, and redirects to the `callbackUrl` →
   `GET /api/v1/auth/mobile-callback`, which mints a **one-time, 120-second, PKCE-bound
   handoff code** and `302`-redirects to your custom scheme:
   ```
   ourbigfamilykitchen://auth?code=<handoffCode>
   ```
4. **The app receives the deep link** (register the `ourbigfamilykitchen` scheme; handle
   `onOpenURL`) and **exchanges the code over HTTPS**:
   ```
   POST /api/v1/auth/token
   { "code": "<handoffCode>", "code_verifier": "<verifier>" }
   ```
   Response (same shape as the web/session `GET`):
   ```json
   {
     "accessToken": "<JWT>",
     "tokenType": "bearer",
     "expiresIn": 3600,
     "expiresAt": "2026-06-13T17:00:00.000Z",
     "supabaseUrl": "https://glyukuiofsurjwlluhqe.supabase.co",
     "supabaseAnonKey": "sb_publishable_…"
   }
   ```
   The Supabase token never travels in a URL — only the short-lived, PKCE-protected code
   does, so a hijacked deep link is useless without the in-app `code_verifier`.
5. **Construct the Supabase client** with `supabaseUrl` + `supabaseAnonKey`, then attach
   `accessToken` (supabase-swift: set it on the auth session / pass as the
   `Authorization: Bearer` header).
6. **Refresh.** The token lasts 1 hour. Store it in the Keychain and, before expiry,
   re-run the exchange. (A future `/api/v1/auth/refresh` may streamline this; for now,
   re-auth via the bridge, or keep the browser session warm and call the session `GET`.)

> **`GET /api/v1/auth/token`** still exists for a client that already holds a NextAuth
> session cookie (web, or testing). The native path uses the **`POST` + code** above.
>
> The token carries `email`, `role: authenticated`, `sub: <contributorId>`, and
> `app_role` (`admin` | `contributor`). RLS resolves the current contributor from the
> `email` claim — see `public.current_contributor_id()` / `public.is_admin()` in
> `supabase/migrations/0004_rls.sql`. It's a standard HS256 Supabase JWT
> (`aud: authenticated`), accepted by supabase-swift with no special config.
>
> Custom scheme is `ourbigfamilykitchen://` (override server-side via `MOBILE_APP_SCHEME`
> if the app uses a different one). Universal Links are a later hardening option — they'd
> need the app's Team ID + bundle id and an AASA file.

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

> **The app is sign-in-only.** Truly anonymous (unauthenticated) clients have **no data
> access** — `0037` grants tables to `authenticated` only, so an anon key gets `403 /
> 42501`. There is intentionally no public-browse path on mobile. "Guests" are *signed-in*
> view-only accounts (invite links, `0036_viewer_invites`), not anonymous visitors. (The
> public website renders published content server-side via the service role; that's a web
> concern and does not apply to the app.)

RLS is the canonical definition (`supabase/migrations/0004_rls.sql`, `0032_rls_family_tables.sql`).
The shape, for a **signed-in** client:

| Area | Guest (view-only) | Contributor | Admin |
|---|---|---|---|
| **Published recipes** (+ ingredients, instructions, tags, photos) | read | read | read |
| **Unpublished/draft recipes** | — | own only | all |
| **Recipe writes** | — | insert own, edit own | edit/delete any |
| **Comments** (`comments`, `recipe_comments`) | read | read + add + edit/delete own | moderate all |
| **Family lines / sections / tags** | read | read (+ add tags) | structural writes |
| **Contributors** | read profiles | read all, edit self | invite/remove |
| **Family photos** (album) | read *reviewed* photos | read reviewed + own; upload | all |
| **Submissions / invitations / federation / invite_links** | — | — / own | full |

Two cross-cutting rules to know:

- **Ownership inheritance**: child rows (ingredients, instructions, recipe_tags,
  photos) inherit their parent recipe's visibility — you don't re-check them
  separately.
- **Album visibility**: `family_photos` are readable once `reviewed = true` (or you're
  the uploader / an admin) — see `family_photos_read` in `0032`.

Build the app assuming RLS will reject anything out of scope — don't reimplement these
rules client-side as security, only as UI hints.

---

## 3. Storage

Three buckets (note: the bucket is `recipe-photos`, not `photos` — `photos` is a *table*):

- **`recipe-photos`** — **public** bucket, world-readable Storage policy. Recipe/dish
  images. Use the public URL directly: `photos.url` is authoritative, or build it with
  `getPublicUrl(storage_path)`. The `photos` table's `photo_type` is `'dish'` | `'source'`
  — prefer a `'dish'` photo for a recipe-card thumbnail.
- **`contributor-photos`** — **public** bucket (avatars). Public URL.
- **`family-photos`** — **PRIVATE** bucket. `0026` made it private and dropped the public
  read policy, so **no client role (anon or authenticated) can read or sign these objects
  directly** — only the service role can. The web serves them as short-lived signed URLs
  generated server-side. So for the album, the app must get signed URLs from a web
  endpoint, **not** from the supabase-swift Storage API. That endpoint doesn't exist yet
  — flag it when you start album work and the web side will add
  `POST /api/v1/photos/sign` (signs `family_photos.storage_path` / `thumb_path` for paths
  the caller may see). Treat the legacy `photos.url` field as non-authoritative for family
  photos.

`backups` is server-only — ignore it.

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
