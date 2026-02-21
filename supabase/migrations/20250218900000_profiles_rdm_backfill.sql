-- Backfill RDM for profiles that have NULL or 0 (e.g. created before column or default not applied).
UPDATE public.profiles SET rdm = 100 WHERE rdm IS NULL OR rdm = 0;
