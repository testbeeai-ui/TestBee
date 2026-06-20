-- Summary stats for prep calendar: streak from p_today backwards, total distinct active days (all time).

create or replace function public.get_prep_calendar_summary(p_today date)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  streak_val int := 0;
  d date;
  total_val int;
begin
  if uid is null then
    return json_build_object('streak', 0, 'total_active_days', 0);
  end if;

  select count(*)::int into total_val
  from public.prep_calendar_day_activity
  where user_id = uid
    and (class_count + revision_count + mock_count + doubt_count) > 0;

  d := p_today;
  loop
    exit when not exists (
      select 1
      from public.prep_calendar_day_activity
      where user_id = uid
        and day = d
        and (class_count + revision_count + mock_count + doubt_count) > 0
    );
    streak_val := streak_val + 1;
    d := d - 1;
    exit when streak_val > 10000;
  end loop;

  return json_build_object(
    'streak', streak_val,
    'total_active_days', coalesce(total_val, 0)
  );
end;
$$;

grant execute on function public.get_prep_calendar_summary(date) to authenticated;
