-- Marketing / UI copy: minimum RDM shown on Refer & Earn "What can you do with RDM?" tiles
INSERT INTO public.rdm_config (key, value, description) VALUES
  ('redeem_practice_packs_from_rdm', 50, 'Practice Packs — “from” RDM (marketing copy)'),
  ('redeem_mock_tests_from_rdm', 100, 'Mock Tests — “from” RDM (marketing copy)'),
  ('redeem_analytics_pro_from_rdm', 200, 'Analytics Pro — “from” RDM (marketing copy)'),
  ('redeem_edufund_entry_from_rdm', 500, 'EduFund entry — “from” RDM (marketing copy)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;
