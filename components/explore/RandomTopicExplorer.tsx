'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, ArrowRight, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TopicNode } from '@/data/topicTaxonomy';
import type { Subject } from '@/types'; // used for subjectBadge/subjectLabel keys

const subjectBadge: Record<Subject, { bg: string; text: string }> = {
  physics: { bg: 'bg-blue-500/15', text: 'text-blue-700' },
  chemistry: { bg: 'bg-purple-500/15', text: 'text-purple-700' },
  math: { bg: 'bg-orange-500/15', text: 'text-orange-700' },
  biology: { bg: 'bg-green-500/15', text: 'text-green-700' },
};

const subjectLabel: Record<Subject, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  math: 'Math',
  biology: 'Biology',
};

function buildDescription(node: TopicNode): string {
  if (node.subtopics.length === 0) return `Explore ${node.topic} in ${subjectLabel[node.subject]}.`;
  const names = node.subtopics.map((s) => s.name);
  if (names.length <= 3) return `Covers ${names.join(', ')}.`;
  return `Covers ${names.slice(0, 3).join(', ')}, and real-world applications.`;
}

function buildTitle(node: TopicNode): string {
  if (node.unitTitle && node.unitTitle !== node.topic) {
    return `${node.topic} \u2014 ${node.unitTitle}`;
  }
  if (node.chapterTitle && node.chapterTitle !== node.topic) {
    return `${node.topic} \u2014 ${node.chapterTitle}`;
  }
  return node.topic;
}

interface RandomTopicExplorerProps {
  taxonomy: TopicNode[];
  onExploreTopic: (node: TopicNode) => void;
}

export default function RandomTopicExplorer({ taxonomy, onExploreTopic }: RandomTopicExplorerProps) {
  const [current, setCurrent] = useState<TopicNode | null>(null);

  // Pick initial random topic once taxonomy loads
  useEffect(() => {
    if (taxonomy.length === 0 || current) return;
    queueMicrotask(() => {
      setCurrent(taxonomy[Math.floor(Math.random() * taxonomy.length)]);
    });
  }, [taxonomy, current]);

  const shuffle = useCallback(() => {
    if (taxonomy.length === 0) return;
    let next: TopicNode;
    do {
      next = taxonomy[Math.floor(Math.random() * taxonomy.length)];
    } while (taxonomy.length > 1 && next.topic === current?.topic);
    setCurrent(next);
  }, [taxonomy, current]);

  if (!current) return null;

  const badge = subjectBadge[current.subject];
  const chapterNum = current.unitLabel ? `Ch. ${current.unitLabel}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.35 }}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground">Random topic explorer</h3>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.topic}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {/* Title */}
          <h4 className="text-lg font-extrabold text-foreground leading-tight mb-2.5">
            {buildTitle(current)}
          </h4>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            <Badge
              variant="outline"
              className={`text-[11px] font-bold capitalize border-0 ${badge.bg} ${badge.text}`}
            >
              {subjectLabel[current.subject]}
            </Badge>
            {chapterNum && (
              <Badge
                variant="outline"
                className="text-[11px] font-bold border-0 bg-muted/60 text-muted-foreground"
              >
                {chapterNum}
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-5">
            {buildDescription(current)}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Actions row — exactly like mockup */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/40">
        <button
          type="button"
          onClick={() => onExploreTopic(current)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline py-2"
        >
          Explore topic
        </button>
        <div className="flex items-center gap-4">
          <Link
            href="/doubts"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Ask doubt
          </Link>
          <button
            type="button"
            onClick={shuffle}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Shuffle
          </button>
        </div>
      </div>
    </motion.div>
  );
}
