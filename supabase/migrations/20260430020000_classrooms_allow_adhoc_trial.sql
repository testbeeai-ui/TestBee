-- Add explicit visibility flag for Explore / public classrooms listing.
-- When allow_adhoc_trial = false, classroom should not appear on /classrooms explore grid.

alter table public.classrooms
  add column if not exists allow_adhoc_trial boolean not null default true;

-- Backfill: older rows without an explicit flag stay discoverable by default.
-- (Teachers can later toggle via settings when we add UI for it.)

