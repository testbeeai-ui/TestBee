-- Streak must not require activity on p_today: anchor on the latest day <= p_today with
-- active_ms > 0, then count consecutive calendar days backward (same as typical “current streak”).
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
  d_anchor date;
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

  select max(day) into d_anchor
  from public.user_study_day_totals
  where user_id = uid
    and day <= p_today
    and active_ms > 0;

  if d_anchor is null then
    return json_build_object(
      'streak', 0,
      'activeDaysThisMonth', coalesce(active_month, 0)
    );
  end if;

  d := d_anchor;
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
