# Our Big Family Kitchen — Companion Mobile App

> Copy this file to the **root of the mobile repo** as `CLAUDE.md`. It orients Claude
> Code to how this app relates to the web product. Edit the bracketed bits once the
> stack/host are settled.

## What this is

The companion **iOS / iPadOS / Android** apps for Our Big Family Kitchen, a multi-family
heritage cookbook and family photo archive. The **web app is the primary product and the
source of truth.** These apps are *clients* of the same backend — they do not own data or
business rules, and they are not a fork or a reimplementation of the web product.

- **Backend:** Supabase (Postgres + Auth-via-JWT + Storage + Realtime).
- **The real source of truth** is the Supabase **schema + RLS policies**, defined by
  migrations in the web repo. Never assume a rule — read the contract / migrations.
- **Stack:** [React Native + Expo / Flutter / native Swift + Kotlin — your call; see
  "Open decisions" below].

## What the apps do (scope)

A native experience over the same data the web product exposes. In the web product today
that means:

- **Browse & read** — published recipes (ingredients, instructions, tags, photos),
  family lines / sections, and the photo album.
- **The family photo album** — the grid, individual photos, captions, memories, people
  tags, and occasions.
- **Participate** — comments on recipes and photos; contribute recipes (paste / URL /
  photo-of-a-card); upload photos; the photo-editor tier fixing details.
- **Same identity & access model** — magic-link sign-in; the contributor / admin /
  photo-editor roles; public-vs-private areas; and view-only guest accounts via invite
  links. RLS enforces all of it identically for mobile.

**Where mobile should eventually beat the web** (the native reasons these apps exist):

- **Camera capture** for photos and recipe cards, feeding the web product's existing
  vision/OCR pipeline.
- **Offline reading** of recipes in the kitchen.
- **Push notifications** (new recipe, new comment).
- Native **share-sheet** import.

## Open decisions (confirm with Kate before building features)

These were *assumed* when this project was scaffolded — they are not settled. Confirm
before committing to a v1 feature set:

1. **Parity vs. read-first.** Is v1 a full contributor experience (browse + comment +
   add recipes + upload/edit photos), or does it start as a polished **read + browse +
   comment** app with contribution added later?
2. **Native-first features.** Is **camera capture / recipe-card scanning** a headline v1
   feature, or later? Same question for **offline** and **push notifications**.
3. **Audience.** Same invited-family-only model as the web (everyone signs in), or any
   notion of a public "browse the cookbook" mode on mobile?
4. **Stack.** Your choice. React Native / Expo gives you TypeScript type-sharing with the
   web's generated types for free; native Swift / Kotlin treats the schema as a reference
   rather than shared code. Either works with the contract below.

## The contract (read this before touching data code)

The web repo ships a `contract/` folder. Treat `contract/README.md` as authoritative
for: the auth flow, the `/api/v1/auth/token` endpoint, the access model, Storage, and
the generated schema types. It's wired in here as:

- [ ] **git submodule** at `./web-contract` (pointing at the web repo), **or**
- [ ] a **copied** `contract/` + `types/supabase.ts` synced on each schema change.

When the schema changes upstream, re-sync the generated `types/supabase.ts` and reread
`contract/README.md` — don't infer columns from memory.

## Auth, in one paragraph

Sign-in is NextAuth magic links, completed in an in-app browser against the web host.
After sign-in, `GET /api/v1/auth/token` returns a short-lived (1h) **Supabase JWT**
plus the Supabase URL + anon key. Construct the Supabase SDK with those, set the access
token, and talk to Supabase directly — RLS enforces the access model as the signed-in
contributor. Refresh by re-calling the token endpoint before expiry. Full detail:
`contract/README.md` §1.

## Working agreements

- **Don't reimplement access rules as security.** RLS is the gate. Client-side checks
  are UI hints only (hide an edit button), never the enforcement.
- **Additive over breaking.** If you need a schema or API change, it lands in the
  **web repo first** (migration + `npm run gen:types`), then this app consumes it.
  Flag anything that needs a new column or a `/api/v2` to Kate.
- **Match the product's voice** in user-facing copy: warm, specific, concise.
- **Verify before claiming done:** build the app and exercise the real flow, not just
  unit tests.

## Pointers

| | |
|---|---|
| Web repo | [github.com/<org>/our-big-family-kitchen] |
| Contract | `contract/README.md` (this defines the interface) |
| Token endpoint | `GET <web-host>/api/v1/auth/token` |
| Generated types | `types/supabase.ts` (regenerate with `npm run gen:types` in web repo) |
