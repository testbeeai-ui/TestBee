'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Heart, MessageSquare, Zap } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { TopicNode } from '@/data/topicTaxonomy';
import type { Subject } from '@/types';
import type { FeedPost } from '@/hooks/useExploreHubData';
import { SUBJECT_FEED_ICON as subjectIcon, SUBJECT_FEED_ICON_CLASS as subjectIconClass } from './subjectFeedIcons';

const subjectLabel: Record<Subject, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  math: 'Mathematics',
  biology: 'Biology',
};

interface StudentProfile {
  name: string;
  initials: string;
  color: string;
}

const studentProfiles: StudentProfile[] = [
  { name: 'Arjun Kumar', initials: 'AK', color: 'bg-green-500/15 text-green-700' },
  { name: 'Priya M', initials: 'PM', color: 'bg-purple-500/15 text-purple-700' },
  { name: 'Ravi S', initials: 'RS', color: 'bg-teal-500/15 text-teal-700' },
  { name: 'Sneha R', initials: 'SR', color: 'bg-pink-500/15 text-pink-700' },
  { name: 'Karthik V', initials: 'KV', color: 'bg-blue-500/15 text-blue-700' },
  { name: 'Ananya D', initials: 'AD', color: 'bg-orange-500/15 text-orange-700' },
  { name: 'Rahul T', initials: 'RT', color: 'bg-indigo-500/15 text-indigo-700' },
  { name: 'Meera K', initials: 'MK', color: 'bg-rose-500/15 text-rose-700' },
];

type PostTemplate = {
  action: (topic: string, subject: string) => string;
  body: (topic: string, subtopics: string[]) => string;
  type: 'achievement' | 'question' | 'share' | 'instacue';
};

const postTemplates: PostTemplate[] = [
  {
    action: (topic, subject) => `Just aced ${subject} mock!`,
    body: (topic, subs) => `Anyone else find ${subs[0] || topic} tricky at first?`,
    type: 'achievement',
  },
  {
    action: (_topic, _subject) => `Shared an Instacue`,
    body: (topic, _subs) => `Shared an Instacue on ${topic} \u2014 short, crisp, bookmark it!`,
    type: 'instacue',
  },
  {
    action: (_topic, subject) => `Posted a new doubt`,
    body: (topic, subs) => `on ${subs[0] || topic}. Anyone up to help?`,
    type: 'question',
  },
  {
    action: (topic, _subject) => `Completed ${topic}`,
    body: (_topic, subs) => `Covered all ${subs.length} subtopics. The key formulas are worth bookmarking.`,
    type: 'achievement',
  },
  {
    action: (_topic, subject) => `Exploring ${subject}`,
    body: (topic, subs) => `Started ${topic} today. ${subs[0] || 'First chapter'} looks interesting!`,
    type: 'share',
  },
  {
    action: (_topic, _subject) => `Study tip`,
    body: (topic, _subs) => `Pro tip: practice ${topic} problems daily, not just before exams. Consistency beats cramming.`,
    type: 'share',
  },
];

interface FeedItem {
  id: string;
  student: StudentProfile;
  template: PostTemplate;
  topic: TopicNode;
  timeLabel: string;
}

const timePhrases = ['2h ago', '5h ago', '34 boosts', '1h ago', '3h ago', '12 boosts'];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

interface CommunityFeedProps {
  taxonomy: TopicNode[];
  onExploreTopic: (node: TopicNode) => void;
  /** When real doubt posts exist, show those instead of generated feed */
  livePosts?: FeedPost[];
}

export default function CommunityFeed({ taxonomy, onExploreTopic, livePosts }: CommunityFeedProps) {
  const hasLivePosts = livePosts && livePosts.length > 0;
  const feedItems = useMemo<FeedItem[]>(() => {
    if (taxonomy.length === 0) return [];
    // Use today's date as seed so feed changes daily but stays stable within a session
    const today = new Date();
    const daySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const rand = seededRandom(daySeed);

    const items: FeedItem[] = [];
    const usedTopicKeys = new Set<string>();
    const usedStudentIdx = new Set<number>();
    const subjects: Subject[] = ['physics', 'chemistry', 'math', 'biology'];

    // Group taxonomy by subject for balanced picking
    const bySubject: Record<string, TopicNode[]> = {};
    for (const t of taxonomy) {
      (bySubject[t.subject] ??= []).push(t);
    }

    for (let i = 0; i < 6; i++) {
      // Rotate subjects so we get variety
      const targetSubject = subjects[i % subjects.length];
      const pool = bySubject[targetSubject] || taxonomy;
      let topic: TopicNode;
      let attempts = 0;
      do {
        topic = pool[Math.floor(rand() * pool.length)];
        attempts++;
      } while (usedTopicKeys.has(topic.topic) && attempts < 20);
      usedTopicKeys.add(topic.topic);

      // Pick unique student
      let sIdx: number;
      let sAttempts = 0;
      do {
        sIdx = Math.floor(rand() * studentProfiles.length);
        sAttempts++;
      } while (usedStudentIdx.has(sIdx) && sAttempts < 15);
      usedStudentIdx.add(sIdx);

      const student = studentProfiles[sIdx];
      const template = postTemplates[i % postTemplates.length];
      const timeLabel = timePhrases[i % timePhrases.length];

      items.push({
        id: `feed-${i}`,
        student,
        template,
        topic,
        timeLabel,
      });
    }
    return items;
  }, [taxonomy]);

  if (taxonomy.length === 0) {
    return (
      <div id="community-feed" className="space-y-3">
        <h3 className="text-base font-bold text-foreground">Community feed</h3>
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl p-4 border border-border animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Live posts rendering helper
  const renderLivePosts = (posts: FeedPost[]) =>
    posts.slice(0, 6).map((post, i) => {
      const name = post.profiles?.name || 'Anonymous';
      const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const subj = (post.subject || 'physics') as Subject;
      const SubjectGlyph = subjectIcon[subj] || subjectIcon.physics;
      const timeAgo = formatTimeAgo(post.created_at);

      return (
        <motion.div
          key={post.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3 }}
          className="py-4 border-b border-border/60 last:border-b-0"
        >
          <div className="flex gap-3">
            <Avatar className="w-10 h-10 shrink-0">
              <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm mb-0.5 flex-wrap">
                <span className="font-bold text-foreground">{name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span className="inline-flex items-center gap-1">
                  <SubjectGlyph
                    className={`h-3.5 w-3.5 shrink-0 ${subjectIconClass[subj] || 'text-blue-600'}`}
                    aria-hidden
                  />
                  {subjectLabel[subj] || subj}
                </span>
                <span>&middot;</span>
                <span>{timeAgo}</span>
              </div>
              <Link href={`/doubts/${post.id}`} className="text-left group block">
                <p className="text-sm font-semibold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
                  {post.title}
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-2.5 line-clamp-2">
                  {post.body}
                </p>
              </Link>
              <div className="flex items-center flex-wrap gap-1 -ml-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-pink-600 hover:bg-pink-500/10 transition-colors"
                >
                  <Heart className="w-3.5 h-3.5" />
                  {post.upvotes > 0 ? post.upvotes : 'Relate'}
                </button>
                <Link
                  href={`/doubts/${post.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {post.answer_count > 0 ? `${post.answer_count} replies` : 'Reply'}
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-yellow-600 hover:bg-yellow-500/10 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Boost
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      );
    });

  return (
    <div id="community-feed" className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-foreground">Community feed</h3>
        <Link href="/doubts" className="text-xs font-bold text-primary hover:underline">
          See all
        </Link>
      </div>

      {/* Show real Supabase doubts when available, otherwise generated curriculum feed */}
      {hasLivePosts ? renderLivePosts(livePosts!) : feedItems.map((item, i) => {
        const SubjectGlyph = subjectIcon[item.topic.subject];
        const subjectName = subjectLabel[item.topic.subject];
        const subtopicNames = item.topic.subtopics.map((s) => s.name);
        const actionText = item.template.action(item.topic.topic, subjectName);
        const bodyText = item.template.body(item.topic.topic, subtopicNames);

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="py-4 border-b border-border/60 last:border-b-0"
          >
            <div className="flex gap-3">
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarFallback className={`text-xs font-bold ${item.student.color}`}>
                  {item.student.initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm mb-0.5 flex-wrap">
                  <span className="font-bold text-foreground">{item.student.name}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="inline-flex items-center gap-1">
                    <SubjectGlyph
                      className={`h-3.5 w-3.5 shrink-0 ${subjectIconClass[item.topic.subject]}`}
                      aria-hidden
                    />
                    {subjectName}
                  </span>
                  <span>&middot;</span>
                  <span>{item.timeLabel}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onExploreTopic(item.topic)}
                  className="text-left group"
                >
                  <p className="text-sm font-semibold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
                    {actionText}
                  </p>
                  <p className="text-[13px] text-muted-foreground leading-relaxed mb-2.5">
                    {bodyText}
                  </p>
                </button>

                {item.template.type === 'instacue' && (
                  <div className="mb-2.5">
                    <span className="text-xs font-medium text-primary hover:underline cursor-pointer">
                      View Instacue
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">&middot;</span>
                    <span className="text-xs font-medium text-muted-foreground ml-2">
                      Boost
                    </span>
                  </div>
                )}

                {item.template.type === 'question' && (
                  <div className="mb-2.5">
                    <Link href="/doubts" className="text-xs font-medium text-primary hover:underline">
                      Help via Gyan++
                    </Link>
                  </div>
                )}

                {(item.template.type === 'achievement' || item.template.type === 'share') && (
                  <div className="flex items-center flex-wrap gap-1 -ml-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-pink-600 hover:bg-pink-500/10 transition-colors"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      Relate
                    </button>
                    <Link
                      href="/doubts"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Reply
                    </Link>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-yellow-600 hover:bg-yellow-500/10 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Boost
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Relative time label from ISO date string */
function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
