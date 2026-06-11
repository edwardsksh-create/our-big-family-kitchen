-- Trusted-contributor tier. When `can_publish` is true, a contributor's
-- submissions skip the admin review queue and publish directly. Admin
-- (role='admin') is always effectively trusted regardless of this flag;
-- can_publish only affects non-admin contributors.
--
-- Defaults to false so every existing contributor stays in the current
-- "submit for review" flow until Kate explicitly trusts them.

alter table contributors
  add column if not exists can_publish boolean not null default false;
