-- Make source_url unique on federated_recipes so we can drop the
-- delete-then-insert pattern in scripts/import-leusch-federation.mjs in
-- favor of upserts on conflict.

drop index if exists federated_recipes_source_idx;
create unique index if not exists federated_recipes_source_url_unique
  on federated_recipes (source_url);
