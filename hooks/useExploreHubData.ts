'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExploreStats {
  streakDays: number;
  rdmEarned: number;
  topicsExplored: number;
  doubtsSolved: number;
}

export interface FeedPost {
  id: string;
  user_id: string;
  title: string;
  body: string;
  subject: string | null;
  upvotes: number;
  downvotes: number;
  is_resolved: boolean;
  bounty_rdm?: number;
  views?: number;
  created_at: string;
  answer_count: number;
  profiles?: { name: string | null; avatar_url: string | null } | null;
}

export interface TrendingItem {
  id: string;
  title: string;
  subject: string | null;
  views: number;
  upvotes: number;
}

interface ExploreHubData {
  stats: ExploreStats;
  feedPosts: FeedPost[];
  trendingTopics: TrendingItem[];
  loading: boolean;
}

/** Row shape from doubts feed select (client-side mapping to FeedPost). */
type DoubtFeedRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  subject: string | null;
  upvotes: number;
  downvotes: number;
  is_resolved: boolean;
  bounty_rdm?: number;
  views?: number;
  created_at: string;
  doubt_answers?: { id: string }[];
  profiles?: { name: string | null; avatar_url: string | null } | null;
};

type DoubtTrendingRow = {
  id: string;
  title: string;
  subject: string | null;
  views: number | null;
  upvotes: number | null;
};

function prevDay(d: string): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function computeStreakDays(dates: string[]): number {
  if (dates.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  const mostRecent = sorted[0];
  const oneDayAgo = prevDay(today);
  if (mostRecent !== today && mostRecent !== oneDayAgo) return 0;
  let count = 0;
  let expect = mostRecent;
  for (const d of sorted) {
    if (d !== expect) break;
    count++;
    expect = prevDay(expect);
  }
  return count;
}

export function useExploreHubData(userId: string | undefined, rdm: number): ExploreHubData {
  const [stats, setStats] = useState<ExploreStats>({
    streakDays: 0,
    rdmEarned: 0,
    topicsExplored: 0,
    doubtsSolved: 0,
  });
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);

      const feedPromise = supabase
        .from('doubts')
        .select('*, doubt_answers(id), profiles!doubts_user_id_fkey(name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(10);

      const since = new Date();
      since.setDate(since.getDate() - 7);
      const trendingPromise = supabase
        .from('doubts')
        .select('id, title, subject, views, upvotes')
        .gte('created_at', since.toISOString())
        .order('views', { ascending: false })
        .order('upvotes', { ascending: false })
        .limit(4);

      const answersPromise = userId
        ? supabase
            .from('doubt_answers')
            .select('id, is_accepted')
            .eq('user_id', userId)
        : Promise.resolve({ data: [] as { id: string; is_accepted: boolean }[] });

      // Streak: count consecutive days with daily_gauntlet_attempts
      const streakPromise = userId
        ? supabase
            .from('daily_gauntlet_attempts')
            .select('played_date')
            .eq('user_id', userId)
            .order('played_date', { ascending: false })
            .limit(60)
        : Promise.resolve({ data: [] as { played_date: string }[] });

      // Topics explored: distinct categories from user_play_stats
      const topicsPromise = userId
        ? supabase
            .from('user_play_stats')
            .select('category')
            .eq('user_id', userId)
        : Promise.resolve({ data: [] as { category: string }[] });

      const [feedRes, trendingRes, answersRes, streakRes, topicsRes] = await Promise.all([
        feedPromise,
        trendingPromise,
        answersPromise,
        streakPromise,
        topicsPromise,
      ]);

      if (cancelled) return;

      // Feed
      const posts: FeedPost[] = ((feedRes.data as DoubtFeedRow[] | null) ?? []).map((d) => ({
        id: d.id,
        user_id: d.user_id,
        title: d.title,
        body: d.body,
        subject: d.subject,
        upvotes: d.upvotes,
        downvotes: d.downvotes,
        is_resolved: d.is_resolved,
        bounty_rdm: d.bounty_rdm,
        views: d.views,
        created_at: d.created_at,
        answer_count: d.doubt_answers?.length ?? 0,
        profiles: d.profiles ?? null,
      }));
      setFeedPosts(posts);

      // Trending
      setTrendingTopics(
        ((trendingRes.data as DoubtTrendingRow[] | null) ?? []).map((d) => ({
          id: d.id,
          title: d.title,
          subject: d.subject,
          views: d.views ?? 0,
          upvotes: d.upvotes ?? 0,
        }))
      );

      // Stats
      const answerList = (answersRes.data || []) as { id: string; is_accepted: boolean }[];
      const accepted = answerList.filter((a) => a.is_accepted).length;

      // Compute streak from daily_gauntlet_attempts dates
      const gauntletDates = ((streakRes.data || []) as { played_date: string }[]).map((r) => r.played_date);
      const streakDays = computeStreakDays(gauntletDates);

      // Count distinct categories from user_play_stats
      const categories = ((topicsRes.data || []) as { category: string }[]).map((r) => r.category);
      const topicsExplored = new Set(categories).size;

      setStats({
        streakDays,
        rdmEarned: rdm,
        topicsExplored,
        doubtsSolved: accepted,
      });

      setLoading(false);
    }

    loadAll();
    return () => { cancelled = true; };
  }, [userId, rdm]);

  return { stats, feedPosts, trendingTopics, loading };
}
