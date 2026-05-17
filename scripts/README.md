# Scripts

One-off and maintenance scripts for the project.

## `import-leusch-federation.mjs`

Mirrors the 331 recipes from `~/Projects/leusch-family-recipes/data/recipes.json`
into our `federated_recipes` table. Idempotent (upserts on `source_url`), so
it's safe to re-run any time the upstream file is regenerated.

Each row stores: canonical `source_url` on leuschfamilyrecipes.com, title,
contributor name, our section slug, and a pre-built `search_tokens` blob.

```bash
node --env-file=.env.local scripts/import-leusch-federation.mjs
```

Run it whenever:
- Aunt Laura's recipe data is updated upstream
- Sections, contributors, or attribution change
- You want to refresh `search_tokens` after a search-ranking tweak
