-- Persist Dive undertaking acceptance with hub progress (cross-device).
alter table public.dive_hub_progress
  add column if not exists undertaking_accepted boolean not null default false;

comment on column public.dive_hub_progress.undertaking_accepted is
  'True after user accepts Quiz/Numerals/Outcomes undertaking for this subtopic.';
