-- Gyan++ bot profiles: set display RDM (< 1000). Values must match lib/gyanBotPersonas.ts.
-- Wallet trigger (profiles_enforce_rdm_integrity) blocks direct rdm writes unless
-- session GUC app.allow_profile_rdm_mutation = '1' (same pattern as add_rdm / deduct_rdm).

DO $$
DECLARE
  v_prev text;
BEGIN
  v_prev := NULLIF(current_setting('app.allow_profile_rdm_mutation', true), '');
  PERFORM set_config('app.allow_profile_rdm_mutation', '1', true);
  UPDATE public.profiles AS p
  SET rdm = v.rdm
  FROM (
    VALUES
      ('f2a00000-0000-4000-8000-000000000001'::uuid, 847),
      ('f2a00000-0000-4000-8000-000000000002'::uuid, 567),
      ('f2a00000-0000-4000-8000-000000000003'::uuid, 623),
      ('f2a00000-0000-4000-8000-000000000004'::uuid, 596),
      ('f2a00000-0000-4000-8000-000000000005'::uuid, 891),
      ('f2a00000-0000-4000-8000-000000000006'::uuid, 432),
      ('f2a00000-0000-4000-8000-000000000007'::uuid, 712),
      ('f2a00000-0000-4000-8000-000000000008'::uuid, 345),
      ('f2a00000-0000-4000-8000-000000000009'::uuid, 978),
      ('f2a00000-0000-4000-8000-00000000000a'::uuid, 234),
      ('f2a00000-0000-4000-8000-00000000000b'::uuid, 654),
      ('f2a00000-0000-4000-8000-00000000000c'::uuid, 987),
      ('f2a00000-0000-4000-8000-00000000000d'::uuid, 501)
  ) AS v(id, rdm)
  WHERE p.id = v.id;
  IF v_prev IS NULL THEN
    PERFORM set_config('app.allow_profile_rdm_mutation', '0', true);
  ELSE
    PERFORM set_config('app.allow_profile_rdm_mutation', v_prev, true);
  END IF;
END $$;
