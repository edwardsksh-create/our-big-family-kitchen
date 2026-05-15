-- Seed the bootstrap admin contributor.
-- The email is parameterized via :admin_email; for one-shot dashboard runs
-- we inline it below. Update if Kate ever changes her primary email.

insert into contributors (email, name, role, joined_at)
values ('edwards.ksh@gmail.com', 'Kate', 'admin', now())
on conflict (email) do update set role = 'admin';
