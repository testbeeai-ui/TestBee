-- Teacher profile details (KYC + professional metadata)
-- Created: 2026-05-01

create table if not exists public.teacher_profile_details (
  teacher_id uuid primary key
    references public.profiles(id) on delete cascade,
  location text,
  qualification text,
  experience text,
  email text,
  phone text,
  youtube_or_social text,

  -- Verification docs (either URL or share link is acceptable per doc type)
  aadhar_photo_url text,
  aadhar_share_link text,
  institute_certificate_photo_url text,
  institute_certificate_share_link text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teacher_profile_details is
  'Extended teacher profile fields including optional KYC/verification links and professional details.';

comment on column public.teacher_profile_details.teacher_id is
  'Maps 1:1 to profiles.id for teacher accounts.';
comment on column public.teacher_profile_details.aadhar_photo_url is
  'Direct URL to Aadhaar photo/proof (optional if share link exists).';
comment on column public.teacher_profile_details.aadhar_share_link is
  'Shareable link to Aadhaar proof (optional if photo URL exists).';
comment on column public.teacher_profile_details.institute_certificate_photo_url is
  'Direct URL to institute/study certificate proof (optional if share link exists).';
comment on column public.teacher_profile_details.institute_certificate_share_link is
  'Shareable link to institute/study certificate proof (optional if photo URL exists).';

-- Keep updated_at in sync
create or replace function public.set_teacher_profile_details_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_teacher_profile_details_updated_at on public.teacher_profile_details;
create trigger trg_teacher_profile_details_updated_at
before update on public.teacher_profile_details
for each row
execute function public.set_teacher_profile_details_updated_at();

-- Basic data quality check:
-- For each doc type, at least one of (photo_url, share_link) should be present when row exists.
alter table public.teacher_profile_details
  drop constraint if exists teacher_profile_details_doc_presence_chk;

alter table public.teacher_profile_details
  add constraint teacher_profile_details_doc_presence_chk
  check (
    (
      coalesce(nullif(trim(aadhar_photo_url), ''), nullif(trim(aadhar_share_link), '')) is not null
    )
    and
    (
      coalesce(
        nullif(trim(institute_certificate_photo_url), ''),
        nullif(trim(institute_certificate_share_link), '')
      ) is not null
    )
  );

-- Optional light URL shape checks (allow plain handles for social if needed, so not strict there)
alter table public.teacher_profile_details
  drop constraint if exists teacher_profile_details_email_format_chk;

alter table public.teacher_profile_details
  add constraint teacher_profile_details_email_format_chk
  check (
    email is null
    or trim(email) = ''
    or email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  );

-- RLS
alter table public.teacher_profile_details enable row level security;

-- Clean old policies if re-running migration
drop policy if exists "teacher_profile_details_select_owner_or_members" on public.teacher_profile_details;
drop policy if exists "teacher_profile_details_insert_owner" on public.teacher_profile_details;
drop policy if exists "teacher_profile_details_update_owner" on public.teacher_profile_details;
drop policy if exists "teacher_profile_details_delete_owner" on public.teacher_profile_details;

-- SELECT:
-- 1) owner can read own details
-- 2) members of classrooms taught by this teacher can read (for student-facing teacher profile cards/pages)
create policy "teacher_profile_details_select_owner_or_members"
on public.teacher_profile_details
for select
to authenticated
using (
  auth.uid() = teacher_id
  or exists (
    select 1
    from public.classroom_members cm
    join public.classrooms c on c.id = cm.classroom_id
    where cm.user_id = auth.uid()
      and c.teacher_id = teacher_profile_details.teacher_id
  )
);

-- INSERT: only the owner can create their row
create policy "teacher_profile_details_insert_owner"
on public.teacher_profile_details
for insert
to authenticated
with check (
  auth.uid() = teacher_id
);

-- UPDATE: only the owner can update their row
create policy "teacher_profile_details_update_owner"
on public.teacher_profile_details
for update
to authenticated
using (
  auth.uid() = teacher_id
)
with check (
  auth.uid() = teacher_id
);

-- DELETE: only the owner can delete their row
create policy "teacher_profile_details_delete_owner"
on public.teacher_profile_details
for delete
to authenticated
using (
  auth.uid() = teacher_id
);

-- Helpful index for joins/filtering (PK already covers teacher_id; kept explicit for readability/idempotence)
create index if not exists idx_teacher_profile_details_teacher_id
  on public.teacher_profile_details (teacher_id);
