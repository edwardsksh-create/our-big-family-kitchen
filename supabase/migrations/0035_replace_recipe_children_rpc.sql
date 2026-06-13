-- Transactional recipe child-table sync (security gate item 8, the
-- "move to an RPC" upgrade to the error-checking added in PR #4).
--
-- The five child syncs in lib/recipes/save.ts (ingredients, instructions,
-- tags, occasions, photos) were delete-then-insert run from the app one
-- statement at a time. PR #4 made every step throw on error so a failure is
-- loud and a retry converges — but between a landed delete and a failed
-- insert the recipe is momentarily missing its content. This function does
-- the whole replace inside ONE transaction (a plpgsql function runs
-- atomically): if anything fails, every change rolls back and the recipe's
-- children are left exactly as they were.
--
-- The app resolves the "smart" parts first (trim/filter rows, slugify tag
-- names, validate occasion slugs against the vocabulary, build the ordered
-- photo list) and passes fully-resolved JSON — so this function contains no
-- slugify/validation logic to drift from the TS. save.ts falls back to the
-- old per-statement path if this function is absent, so deploying the code
-- and applying this migration can happen in either order safely.
--
-- Inputs (all jsonb arrays):
--   p_ingredients:  [{ sub_header (text|null), item_text, sort_order }]
--   p_instructions: [{ sub_header (text|null), body, sort_order }]
--   p_tags:         [{ slug, name }]            -- find-or-create, atomic
--   p_occasions:    ["slug", ...]               -- already validated
--   p_photos:       [{ storage_path, url, thumb_path (text|null),
--                      caption (text|null), photo_type, sort_order }]
--                   -- ordered; upsert-by-storage_path preserves photo ids,
--                      photos whose path isn't in the list are removed.

create or replace function public.replace_recipe_children(
  p_recipe_id      uuid,
  p_contributor_id uuid,
  p_ingredients    jsonb,
  p_instructions   jsonb,
  p_tags           jsonb,
  p_occasions      jsonb,
  p_photos         jsonb
) returns void
language plpgsql
security definer
set search_path = public as $$
declare
  rec        jsonb;
  v_tag_id   uuid;
  v_tag_ids  uuid[] := array[]::uuid[];
  v_keep     text[];
begin
  -- 1) ingredients: replace wholesale
  delete from ingredients where recipe_id = p_recipe_id;
  insert into ingredients (recipe_id, sub_header, item_text, sort_order)
  select p_recipe_id,
         nullif(e->>'sub_header', ''),
         e->>'item_text',
         (e->>'sort_order')::int
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) e;

  -- 2) instructions: replace wholesale
  delete from instructions where recipe_id = p_recipe_id;
  insert into instructions (recipe_id, sub_header, body, sort_order)
  select p_recipe_id,
         nullif(e->>'sub_header', ''),
         e->>'body',
         (e->>'sort_order')::int
  from jsonb_array_elements(coalesce(p_instructions, '[]'::jsonb)) e;

  -- 3) tags: find-or-create each (atomic), then relink
  delete from recipe_tags where recipe_id = p_recipe_id;
  for rec in select * from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb))
  loop
    select id into v_tag_id from tags where slug = rec->>'slug';
    if v_tag_id is null then
      insert into tags (slug, name) values (rec->>'slug', rec->>'name')
      returning id into v_tag_id;
    end if;
    v_tag_ids := array_append(v_tag_ids, v_tag_id);
  end loop;
  if array_length(v_tag_ids, 1) is not null then
    insert into recipe_tags (recipe_id, tag_id)
    select distinct p_recipe_id, unnest(v_tag_ids);
  end if;

  -- 4) occasions: replace wholesale (slugs pre-validated by the caller)
  delete from recipe_occasions where recipe_id = p_recipe_id;
  insert into recipe_occasions (recipe_id, occasion_slug)
  select p_recipe_id, value::text
  from jsonb_array_elements_text(coalesce(p_occasions, '[]'::jsonb));

  -- 5) photos: upsert-by-storage_path (preserves ids); drop ones not present
  select array_agg(e->>'storage_path')
    into v_keep
  from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) e;
  v_keep := coalesce(v_keep, array[]::text[]);

  delete from photos
   where recipe_id = p_recipe_id
     and (storage_path is null or not (storage_path = any(v_keep)));

  for rec in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb))
  loop
    -- caption/thumb_path passed through as-is to match the app's `?? null`
    -- (an empty-string caption stays '', not null).
    update photos
       set caption    = rec->>'caption',
           sort_order  = (rec->>'sort_order')::int,
           photo_type  = rec->>'photo_type'
     where recipe_id = p_recipe_id and storage_path = rec->>'storage_path';
    if not found then
      insert into photos (recipe_id, contributor_id, url, storage_path,
                          thumb_path, caption, photo_type, sort_order)
      values (p_recipe_id, p_contributor_id, rec->>'url', rec->>'storage_path',
              rec->>'thumb_path', rec->>'caption',
              rec->>'photo_type', (rec->>'sort_order')::int);
    end if;
  end loop;
end $$;

revoke all on function public.replace_recipe_children(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_recipe_children(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
