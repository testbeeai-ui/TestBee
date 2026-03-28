'use client';

import { useState, useEffect, useMemo } from 'react';
import type { TopicNode } from '@/data/topicTaxonomy';
import { fetchFullCurriculumFromSupabase } from '@/lib/curriculumService';

export type TopicTaxonomyState = {
  taxonomy: TopicNode[];
  loading: boolean;
  error: string | null;
};

/**
 * Full syllabus (units → chapters → topics → subtopics) from Supabase only.
 * No static taxonomy is bundled in the client.
 */
export function useTopicTaxonomy(): TopicTaxonomyState {
  const [taxonomy, setTaxonomy] = useState<TopicNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFullCurriculumFromSupabase()
      .then((data) => {
        if (cancelled) return;
        if (data == null || data.length === 0) {
          setTaxonomy([]);
          setError(
            data == null
              ? 'Could not load curriculum from Supabase. In Vercel, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your project. In Supabase, run migrations (curriculum schema + seed). Curriculum tables are readable without sign-in once they exist.'
              : 'No curriculum rows in the database yet. Run the curriculum seed migration on your Supabase project.'
          );
        } else {
          setTaxonomy(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[useTopicTaxonomy]', err);
          setTaxonomy([]);
          setError(err?.message ?? 'Failed to load curriculum.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => ({ taxonomy, loading, error }), [taxonomy, loading, error]);
}
