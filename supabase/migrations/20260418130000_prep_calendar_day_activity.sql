-- Per-user per-day prep activity counts (exam prep calendar dots: class, revision, mock, doubt).

create table if not exists public.prep_calendar_day_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  class_count integer not null default 0 check (class_count >= 0),
  revision_count integer not null default 0 check (revision_count >= 0),
  mock_count integer not null default 0 check (mock_count >= 0),
  doubt_count integer not null default 0 check (doubt_count >= 0),
  updated_at timestamptz not null default now(),
  constraint prep_calendar_day_activity_pkey primary key (user_id, day)
);

create index if not exists prep_calendar_day_activity_user_day_idx
  on public.prep_calendar_day_activity (user_id, day desc);

alter table public.prep_calendar_day_activity enable row level security;

create policy "prep_calendar_day_activity_select_own"
  on public.prep_calendar_day_activity for select
  to authenticated
  using (auth.uid() = user_id);

create policy "prep_calendar_day_activity_insert_own"
  on public.prep_calendar_day_activity for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "prep_calendar_day_activity_update_own"
  on public.prep_calendar_day_activity for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "prep_calendar_day_activity_delete_own"
  on public.prep_calendar_day_activity for delete
  to authenticated
  using (auth.uid() = user_id);

-- Atomic increment (single round-trip, avoids read-modify-write races).
create or replace function public.increment_prep_calendar_day(p_day date, p_field text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d int := case when p_field = 'class' then 1 else 0 end;
  r int := case when p_field = 'revision' then 1 else 0 end;
  m int := case when p_field = 'mock' then 1 else 0 end;
  b int := case when p_field = 'doubt' then 1 else 0 end;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_field is null or p_field not in ('class', 'revision', 'mock', 'doubt') then
    raise exception 'invalid p_field';
  end if;

  insert into public.prep_calendar_day_activity (user_id, day, class_count, revision_count, mock_count, doubt_count)
  values (uid, p_day, d, r, m, b)
  on conflict (user_id, day) do update set
    class_count = prep_calendar_day_activity.class_count + excluded.class_count,
    revision_count = prep_calendar_day_activity.revision_count + excluded.revision_count,
    mock_count = prep_calendar_day_activity.mock_count + excluded.mock_count,
    doubt_count = prep_calendar_day_activity.doubt_count + excluded.doubt_count,
    updated_at = now();
end;
$$;

grant execute on function public.increment_prep_calendar_day(date, text) to authenticated;
