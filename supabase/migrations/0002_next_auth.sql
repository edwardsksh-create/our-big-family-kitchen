-- next_auth schema for the @auth/supabase-adapter
-- Mirrors https://authjs.dev/getting-started/adapters/supabase

create schema if not exists next_auth;

grant usage on schema next_auth to service_role;
grant all  on schema next_auth to postgres;

create table if not exists next_auth.users (
  id              uuid primary key default gen_random_uuid(),
  name            text,
  email           text,
  "emailVerified" timestamptz,
  image           text
);

create unique index if not exists email_unique on next_auth.users (email);

create table if not exists next_auth.sessions (
  id             uuid primary key default gen_random_uuid(),
  expires        timestamptz not null,
  "sessionToken" text not null,
  "userId"       uuid references next_auth.users(id) on delete cascade
);

create unique index if not exists sessions_session_token_unique on next_auth.sessions ("sessionToken");

create table if not exists next_auth.accounts (
  id                  uuid primary key default gen_random_uuid(),
  type                text not null,
  provider            text not null,
  "providerAccountId" text not null,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  oauth_token_secret  text,
  oauth_token         text,
  "userId"            uuid references next_auth.users(id) on delete cascade
);

create unique index if not exists accounts_provider_account_unique
  on next_auth.accounts (provider, "providerAccountId");

create table if not exists next_auth.verification_tokens (
  identifier text not null,
  token      text not null,
  expires    timestamptz not null,
  primary key (identifier, token)
);

-- The adapter is invoked from the Next.js server using the service-role key,
-- so it bypasses RLS. We still enable it to be safe.
alter table next_auth.users               enable row level security;
alter table next_auth.sessions            enable row level security;
alter table next_auth.accounts            enable row level security;
alter table next_auth.verification_tokens enable row level security;
