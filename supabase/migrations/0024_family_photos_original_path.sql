-- Reversibility for photo rotations (EXIF-based batch fix + manual rotate
-- control in /admin/photo-review). When a row's stored pixels are rotated,
-- `storage_path` is updated to point at the new file and the previous path
-- is recorded here, so the original file in the bucket stays intact and
-- can be restored if a rotation turns out wrong.
--
-- NULL when the row has never been rotated. Only set the FIRST time a
-- rotation happens — subsequent rotations should leave this column alone
-- so it always points at the truly-untouched original.

alter table family_photos
  add column if not exists original_storage_path text;
