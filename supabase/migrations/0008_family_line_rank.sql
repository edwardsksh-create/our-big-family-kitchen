-- Add primary/secondary rank to contributor_family_lines.
-- A contributor can have at most one primary and at most one secondary line.

alter table contributor_family_lines
  add column if not exists rank text not null default 'primary'
    check (rank in ('primary', 'secondary'));

-- A contributor can have at most one row per rank.
-- (Two contributors can still share a family_line — that's the whole point.)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname  = 'contributor_family_lines_contributor_rank_unique'
  ) then
    create unique index contributor_family_lines_contributor_rank_unique
      on contributor_family_lines (contributor_id, rank);
  end if;
end$$;
