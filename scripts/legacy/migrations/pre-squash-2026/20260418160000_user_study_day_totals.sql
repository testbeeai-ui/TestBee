-- Per-user per-calendar-day accumulated active study time (ms) for dashboard streak + heatmap.
-- Bumped from topic-quiz saves (API) and play flows (API / client bump).

create table if not exists public.user_study_day_totals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  active_ms bigint not null default 0 check (active_ms >= 0),
  updated_at timestamptz not null default now(),
  constraint user_study_day_totals_pkey primary key (user_id, day)
);

create index if not exists user_study_day_totals_user_day_desc_idx
  on public.user_study_day_totals (user_id, day desc);

alter table public.user_study_day_totals enable row level security;

drop policy if exists "user_study_day_totals_select_own" on public.user_study_day_totals;
create policy "user_study_day_totals_select_own"
  on public.user_study_day_totals for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_study_day_totals_insert_own" on public.user_study_day_totals;
create policy "user_study_day_totals_insert_own"
  on public.user_study_day_totals for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_study_day_totals_update_own" on public.user_study_day_totals;
create policy "user_study_day_totals_update_own"
  on public.user_study_day_totals for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_study_day_totals_delete_own" on public.user_study_day_totals;
create policy "user_study_day_totals_delete_own"
  on public.user_study_day_totals for delete
  to authenticated
  using (auth.uid() = user_id);

-- Atomic add of milliseconds for a calendar day (client supplies local calendar date).
create or replace function public.add_user_study_day_ms(p_day date, p_delta_ms bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d bigint := coalesce(p_delta_ms, 0);
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_day is null then
    raise exception 'p_day required';
  end if;
  if d <= 0 then
    return;
  end if;
  if d > 12 * 60 * 60 * 1000 then
    d := 12 * 60 * 60 * 1000;
  end if;

  insert into public.user_study_day_totals (user_id, day, active_ms)
  values (uid, p_day, d)
  on conflict (user_id, day) do update set
    active_ms = user_study_day_totals.active_ms + excluded.active_ms,
    updated_at = now();
end;
$$;

grant execute on function public.add_user_study_day_ms(date, bigint) to authenticated;

-- Consecutive calendar days ending p_today with any recorded study time.
create or replace function public.get_study_streak_summary(p_today date)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  streak_val int := 0;
  d date;
  month_start date := date_trunc('month', p_today::timestamp)::date;
  month_end date := (date_trunc('month', p_today::timestamp) + interval '1 month - 1 day')::date;
  active_month int := 0;
begin
  if uid is null then
    return json_build_object('streak', 0, 'activeDaysThisMonth', 0);
  end if;

  select count(*)::int into active_month
  from public.user_study_day_totals
  where user_id = uid
    and day >= month_start
    and day <= month_end
    and active_ms > 0;

  d := p_today;
  loop
    exit when not exists (
      select 1
      from public.user_study_day_totals
      where user_id = uid
        and day = d
        and active_ms > 0
    );
    streak_val := streak_val + 1;
    d := d - 1;
    exit when streak_val > 10000;
  end loop;

  return json_build_object(
    'streak', streak_val,
    'activeDaysThisMonth', coalesce(active_month, 0)
  );
end;
$$;

grant execute on function public.get_study_streak_summary(date) to authenticated;
