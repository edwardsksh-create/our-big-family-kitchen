-- View-only ("viewer") accounts + shareable invite links.
--
-- Two additions:
--   1. invitations.role — an invitation now records which role to grant on
--      acceptance ('contributor' as before, or 'viewer'). auth.ts reads it.
--   2. invite_links — a shareable, one-token link any family member can
--      generate to invite a guest. The guest opens /invite/<token>, enters
--      their email, and that creates a normal (email-bound) invitation with
--      the link's role; sign-in then proceeds through the existing flow.
--
-- A "view-only account" is just a contributor with role='viewer': they can
-- sign in and read everything (subject to nothing — viewing is gated only by
-- being signed in), but the app blocks them from contributing.

alter table invitations
  add column if not exists role text not null default 'contributor';

create table if not exists invite_links (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  role          text not null default 'viewer',
  created_by_id uuid references contributors(id) on delete set null,
  note          text,                                   -- optional "for Aunt Lucy's friend"
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '30 days'),
  revoked       boolean not null default false
);

create index if not exists invite_links_token_idx on invite_links (token);

-- RLS on from the start. Writes happen only through the service-role key
-- (the server actions); a family member may read the links they created,
-- and admins read all.
alter table invite_links enable row level security;

drop policy if exists invite_links_read on invite_links;
create policy invite_links_read on invite_links
  for select to authenticated
  using (created_by_id = public.current_contributor_id() or public.is_admin());
