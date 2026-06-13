-- Runtime site settings — admin-editable config that used to live only in
-- config/family.ts. First use: per-area visibility (public/private), so the
-- admin can open or close an area from /admin/visibility without a code
-- change + deploy. The config object stays the default/fallback seed; a row
-- here, once written, is the source of truth.
--
-- One generic key/value table rather than a column-per-setting: future
-- runtime settings (e.g. a maintenance banner) drop in as new keys with no
-- migration. `value` is jsonb so a setting can be a scalar or an object —
-- visibility stores {recipes, family, contributors, album}.
--
-- Access: server-side only, through the service-role key (supabaseAdmin),
-- which is how lib/access.ts reads it and the admin action writes it. RLS is
-- enabled with NO policies, and we deliberately add NO grant to anon/
-- authenticated — visibility is a security gate and must never be reachable
-- (or, worse, writable) by a client token. Like 0033's table, this ships with
-- RLS on from the start; service_role bypasses RLS and keeps full access.

create table if not exists site_settings (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  updated_by uuid        references contributors(id) on delete set null
);

alter table site_settings enable row level security;

-- No policies and no anon/authenticated grants on purpose: this table is
-- server-only. (0037 granted the authenticated role on tables existing then;
-- this one is created after and is intentionally left out of that grant.)

-- Seed the visibility row from the current live config (all-private as of the
-- 0613 change). Harmless if it already exists — keeps the admin UI showing
-- the real state on first load.
insert into site_settings (key, value)
values (
  'visibility',
  '{"recipes":"private","family":"private","contributors":"private","album":"private"}'::jsonb
)
on conflict (key) do nothing;
