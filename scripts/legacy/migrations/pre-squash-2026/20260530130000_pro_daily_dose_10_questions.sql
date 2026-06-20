-- Pro DailyDose matches Starter for now: 10 questions per day (not unlimited).

UPDATE public.rdm_config
SET
  value = 10,
  description = 'Pro plan: DailyDose questions per day'
WHERE key = 'pro_daily_dose_questions_per_day';

INSERT INTO public.rdm_config (key, value, description)
VALUES ('pro_daily_dose_questions_per_day', 10, 'Pro plan: DailyDose questions per day')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;
