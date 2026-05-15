# Our Big Family Kitchen

A multi-family heritage cookbook. Recipes from the Leusch, Sundy, Edwards, Hong,
Quinn, and Branion lines — kept and growing.

Companion to [leuschfamilyrecipes.com](https://leuschfamilyrecipes.com): that
site is the preserved archive; this is the living kitchen.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres, Auth helper tables, Storage)
- NextAuth.js v5 with Resend magic links
- Vercel

## Local development

```bash
cp .env.local.example .env.local
# fill in secrets, then
npm install
npm run dev
```

## Database

Schema lives in [`supabase/migrations`](./supabase/migrations). Apply with:

```bash
supabase login
supabase link --project-ref glyukuiofsurjwlluhqe
supabase db push
```

## Phase 1 scope

Scaffolding, schema, magic-link sign-in, placeholder browsing. Recipe submission,
admin tooling, comments, and federation come in subsequent phases.
