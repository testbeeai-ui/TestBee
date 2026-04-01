'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TopicNode } from '@/data/topicTaxonomy';
import type { Subject } from '@/types';

const subjectTag: Record<Subject, { label: string; color: string }> = {
  math: { label: 'Math', color: 'text-orange-600' },
  biology: { label: 'Bio', color: 'text-green-600' },
  chemistry: { label: 'Chem', color: 'text-purple-600' },
  physics: { label: 'Phys', color: 'text-blue-600' },
};

interface TrendingTopicsProps {
  taxonomy: TopicNode[];
  onExploreTopic: (node: TopicNode) => void;
}

export default function TrendingTopics({ taxonomy, onExploreTopic }: TrendingTopicsProps) {
  // Pick 4 random trending topics from different subjects each render
  const trending = useMemo(() => {
    if (taxonomy.length === 0) return [];
    const bySubject: Record<string, TopicNode[]> = {};
    for (const t of taxonomy) {
      (bySubject[t.subject] ??= []).push(t);
    }
    const subjects = Object.keys(bySubject);
    const picked: TopicNode[] = [];
    // Pick one from each subject first, then fill randomly
    for (const sub of subjects) {
      const list = bySubject[sub];
      if (list.length > 0) {
        picked.push(list[Math.floor(Math.random() * list.length)]);
      }
    }
    // Shuffle and take 4
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    return picked.slice(0, 4);
  }, [taxonomy]);

  if (trending.length === 0) return null;

  return (
    <motion.div
      id="trending-topics"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.35 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <h3 className="text-base font-bold text-foreground mb-3">Trending topics</h3>
      <div className="space-y-0.5">
        {trending.map((item, i) => {
          const tag = subjectTag[item.subject];
          return (
            <button
              key={`${item.subject}-${item.topic}`}
              type="button"
              onClick={() => onExploreTopic(item)}
              className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors group w-full text-left"
            >
              <span className="text-base font-extrabold text-muted-foreground/30 w-5 text-center shrink-0 tabular-nums">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1 truncate">
                {item.topic}
              </span>
              <span className={`text-xs font-bold ${tag.color} shrink-0 bg-muted/40 px-2 py-0.5 rounded`}>
                {tag.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
