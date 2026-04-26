-- Private storage bucket + policies for teacher verification documents
-- Created: 2026-05-01

-- 1) Ensure storage bucket exists (private)
insert into storage.buckets (id, name, public)
values ('teacher-verification-docs', 'teacher-verification-docs', false)
on conflict (id) do update
set public = excluded.public;

-- 2) Restrict file size (10 MB) and mime types (images + PDF)
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
where id = 'teacher-verification-docs';

-- 3) Optional helper: enforce object path starts with "<auth.uid()>/..."
create or replace function public.is_owner_prefixed_storage_path(path text)
returns boolean
language sql
stable
as $$
  select
    split_part(coalesce(path, ''), '/', 1) = auth.uid()::text;
$$;

-- 4) Do not ALTER storage.objects here: on Supabase hosted the migration role may not own
--    that table (SQLSTATE 42501). RLS is already enabled on storage.objects by default.

-- 5) Clean old policies if re-running migration
drop policy if exists "teacher_verif_select_own" on storage.objects;
drop policy if exists "teacher_verif_insert_own" on storage.objects;
drop policy if exists "teacher_verif_update_own" on storage.objects;
drop policy if exists "teacher_verif_delete_own" on storage.objects;

-- 6) Policies for bucket = teacher-verification-docs
-- Read only own files
create policy "teacher_verif_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'teacher-verification-docs'
  and owner = auth.uid()
);

-- Upload only into own folder (path prefix = auth.uid())
create policy "teacher_verif_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'teacher-verification-docs'
  and owner = auth.uid()
  and public.is_owner_prefixed_storage_path(name)
);

-- Update only own files and keep same constraints
create policy "teacher_verif_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'teacher-verification-docs'
  and owner = auth.uid()
)
with check (
  bucket_id = 'teacher-verification-docs'
  and owner = auth.uid()
  and public.is_owner_prefixed_storage_path(name)
);

-- Delete only own files
create policy "teacher_verif_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'teacher-verification-docs'
  and owner = auth.uid()
);

-- 7) Optional index on storage.objects skipped here: CREATE INDEX on storage.objects
--    requires table owner on hosted Supabase (42501). Add in Dashboard → SQL if needed.
