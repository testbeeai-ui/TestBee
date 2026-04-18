-- Foreground tab dwell time per calendar day (separate from study `active_ms` used for streaks).

alter table public.user_study_day_totals
  add column if not exists presence_ms bigint not null default 0 check (presence_ms >= 0);

create or replace function public.add_user_site_presence_ms(p_day date, p_delta_ms bigint)
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
  if d > 5 * 60 * 1000 then
    d := 5 * 60 * 1000;
  end if;

  insert into public.user_study_day_totals (user_id, day, presence_ms)
  values (uid, p_day, d)
  on conflict (user_id, day) do update set
    presence_ms = least(
      user_study_day_totals.presence_ms + excluded.presence_ms,
      20 * 60 * 60 * 1000
    ),
    updated_at = now();
end;
$$;

grant execute on function public.add_user_site_presence_ms(date, bigint) to authenticated;
