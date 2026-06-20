-- Track OTP verification for teacher listing contact email (teacher_profile_details.email)

alter table public.teacher_profile_details
  add column if not exists contact_email_verified_at timestamptz;

alter table public.teacher_profile_details
  add column if not exists verified_contact_email text;

comment on column public.teacher_profile_details.contact_email_verified_at is
  'Timestamp when the teacher completed Supabase email OTP verification for the contact email.';
comment on column public.teacher_profile_details.verified_contact_email is
  'Lowercase email string last verified; must match email column to show verified.';
