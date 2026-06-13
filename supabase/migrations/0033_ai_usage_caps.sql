-- Per-contributor daily cap on AI recipe parsing (security gate item 2).
--
-- Recipe parsing (photo / text / URL) calls Claude and was uncapped per
-- contributor — a runaway client loop or a compromised account could run up
-- unbounded AI spend. This adds a per-contributor, per-day counter and an
-- atomic "reserve a slot" function the parse routes call before invoking the
-- model. The ceiling only bounds abuse; normal use is a few parses a day.
--
-- Unlike the 0016+ tables that 0032 had to retrofit, this table ships WITH
-- RLS enabled from the start. Writes happen only through the security-definer
-- functions below (and the service-role key, which bypasses RLS); a
-- contributor may read their own counter and admins read all.

create table if not exists ai_usage_daily (
  contributor_id uuid not null references contributors(id) on delete cascade,
  usage_date     date not null default current_date,
  count          int  not null default 0,
  primary key (contributor_id, usage_date)
);

alter table ai_usage_daily enable row level security;

drop policy if exists ai_usage_self_read on ai_usage_daily;
create policy ai_usage_self_read on ai_usage_daily
  for select to authenticated
  using (contributor_id = public.current_contributor_id() or public.is_admin());

-- reserve_ai_parse: atomically claim one of today's slots. Returns the new
-- count when allowed; NULL when the contributor is already at the limit (the
-- conflict-update's WHERE skips the row, so RETURNING yields nothing). Being
-- a single atomic statement, concurrent/runaway calls can't slip past the
-- cap the way a check-then-increment could.
create or replace function public.reserve_ai_parse(p_contributor_id uuid, p_limit int)
returns int
language plpgsql
security definer
set search_path = public as $$
declare
  new_count int;
begin
  insert into ai_usage_daily (contributor_id, usage_date, count)
  values (p_contributor_id, current_date, 1)
  on conflict (contributor_id, usage_date) do update
    set count = ai_usage_daily.count + 1
    where ai_usage_daily.count < p_limit
  returning count into new_count;
  return new_count;  -- NULL when already at/over the limit
end $$;

-- release_ai_parse: hand a slot back when the parse didn't actually spend AI
-- (a model error, or a URL that parsed from JSON-LD without the AI fallback),
-- so the contributor isn't charged a daily slot for it. Never drops below 0.
create or replace function public.release_ai_parse(p_contributor_id uuid)
returns void
language sql
security definer
set search_path = public as $$
  update ai_usage_daily
    set count = greatest(count - 1, 0)
    where contributor_id = p_contributor_id and usage_date = current_date
$$;

-- These functions mutate the counter, so keep them off the public/anon/
-- authenticated roles — only the service role (the API routes) calls them.
revoke all on function public.reserve_ai_parse(uuid, int) from public;
revoke all on function public.release_ai_parse(uuid)       from public;
grant execute on function public.reserve_ai_parse(uuid, int) to service_role;
grant execute on function public.release_ai_parse(uuid)       to service_role;
