-- Public bucket for user profile photos (full URL stored in profiles.avatar_url)
-- Paths must start with "<auth.uid()>/..." so users cannot overwrite others' objects.

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update
set public = excluded.public;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
where id = 'profile-avatars';

drop policy if exists "profile_avatars_select_public" on storage.objects;
drop policy if exists "profile_avatars_insert_own" on storage.objects;
drop policy if exists "profile_avatars_update_own" on storage.objects;
drop policy if exists "profile_avatars_delete_own" on storage.objects;

create policy "profile_avatars_select_public"
on storage.objects
for select
using (bucket_id = 'profile-avatars');

create policy "profile_avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and owner = auth.uid()
  and public.is_owner_prefixed_storage_path(name)
);

create policy "profile_avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and owner = auth.uid()
)
with check (
  bucket_id = 'profile-avatars'
  and owner = auth.uid()
  and public.is_owner_prefixed_storage_path(name)
);

create policy "profile_avatars_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and owner = auth.uid()
);
