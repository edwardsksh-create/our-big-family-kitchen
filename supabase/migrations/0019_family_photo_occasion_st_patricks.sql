-- Add St. Patrick's Day to the seeded occasion types, ahead of Easter so the
-- spring/holiday block reads in calendar order. Re-statement of the whole
-- canonical list (with slug as the upsert key) keeps the migration idempotent
-- and lets the sort_order pass safely without arithmetic on existing rows.

insert into family_photo_occasion_types (slug, name, sort_order) values
  ('st-patricks-day',    'St. Patrick''s Day',  1),
  ('easter',             'Easter',              2),
  ('mothers-day',        'Mother''s Day',       3),
  ('fathers-day',        'Father''s Day',       4),
  ('first-communion',    'First Communion',     5),
  ('graduation',         'Graduation',          6),
  ('baby-shower',        'Baby Shower',         7),
  ('birthday',           'Birthday',            8),
  ('backyard-holidays',  'Backyard Holidays',   9),
  ('halloween',          'Halloween',          10),
  ('thanksgiving',       'Thanksgiving',       11),
  ('christmas',          'Christmas',          12),
  ('new-years',          'New Year''s',        13),
  ('wedding',            'Wedding',            14),
  ('anniversary',        'Anniversary',        15),
  ('vacation',           'Vacation',           16),
  ('memorial',           'Memorial',           17),
  ('sunday-dinner',      'Sunday Dinner',      18),
  ('casual-gathering',   'Casual Gathering',   19),
  ('cooking-lesson',     'Cooking Lesson',     20)
on conflict (slug) do update set
  name       = excluded.name,
  sort_order = excluded.sort_order;
