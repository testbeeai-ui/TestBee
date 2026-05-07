-- Teacher verification workflow fields on teacher_profile_details
-- Adds status + admin review metadata without changing existing constraints.

alter table public.teacher_profile_details
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists admin_notes text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz;

alter table public.teacher_profile_details
  drop constraint if exists teacher_profile_details_verification_status_chk;

alter table public.teacher_profile_details
  add constraint teacher_profile_details_verification_status_chk
  check (
    verification_status in ('unverified', 'pending', 'approved', 'rejected')
  );

comment on column public.teacher_profile_details.verification_status is
  'Teacher verification workflow status: unverified, pending, approved, rejected.';
comment on column public.teacher_profile_details.admin_notes is
  'Admin feedback for rejected/correction-required profiles.';
comment on column public.teacher_profile_details.submitted_at is
  'When teacher submitted full verification details for review.';
comment on column public.teacher_profile_details.reviewed_at is
  'When admin reviewed the latest verification submission.';
comment on column public.teacher_profile_details.approved_at is
  'When verification was approved by an admin.';
comment on column public.teacher_profile_details.rejected_at is
  'When verification was rejected by an admin.';
