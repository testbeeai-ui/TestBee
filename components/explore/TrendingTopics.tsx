"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { TopicNode } from "@/data/topicTaxonomy";
import type { Subject } from "@/types";

const subjectTag: Record<Subject, { label: string; color: string }> = {
  math: { label: "Math", color: "text-orange-600" },
  chemistry: { label: "Chem", color: "text-purple-600" },
  physics: { label: "Phys", color: "text-blue-600" },
};

const subjectTagCompact: Record<
  Subject,
  { label: string; border: string; bg: string; text: string }
> = {
  math: {
    label: "Math",
    border: "border-orange-500/20",
    bg: "bg-orange-500/5",
    text: "text-orange-400",
  },
  chemistry: {
    label: "Chem",
    border: "border-purple-500/20",
    bg: "bg-purple-500/5",
    text: "text-purple-400",
  },
  physics: {
    label: "Phys",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    text: "text-blue-400",
  },
};

import { cn } from "@/lib/utils";

interface TrendingTopicsProps {
  taxonomy: TopicNode[];
  onExploreTopic: (node: TopicNode) => void;
  compact?: boolean;
  noCardWrapper?: boolean;
}

export default function TrendingTopics({
  taxonomy,
  onExploreTopic,
  compact = false,
  noCardWrapper = false,
}: TrendingTopicsProps) {
  // Pick random trending topics from different subjects each render
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
    // Shuffle and take 3 (if compact) or 4
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    return picked.slice(0, compact ? 3 : 4);
  }, [taxonomy, compact]);

  if (trending.length === 0) return null;

  return (
    <motion.div
      id="trending-topics"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.35 }}
      className={cn(
        noCardWrapper
          ? "bg-transparent border-0 p-0 shadow-none"
          : cn("rounded-xl border border-border bg-card", compact ? "p-3.5" : "p-4 sm:p-5")
      )}
    >
      {compact ? (
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-3">
          TRENDING THIS WEEK
        </span>
      ) : (
        <h3 className="text-sm font-bold text-foreground mb-2.5 sm:text-base sm:mb-3">
          Trending topics
        </h3>
      )}
      <div className="space-y-0.5">
        {trending.map((item, i) => {
          const tagInfo = compact ? subjectTagCompact[item.subject] : null;
          const tagLegacy = compact ? null : subjectTag[item.subject];
          
          return (
            <button
              key={`${item.subject}-${item.topic}`}
              type="button"
              onClick={() => onExploreTopic(item)}
              className="flex items-center gap-2.5 py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors group w-full text-left sm:gap-3"
            >
              <span className="text-base font-extrabold text-muted-foreground/30 w-5 text-center shrink-0 tabular-nums">
                {i + 1}
              </span>
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1 truncate">
                {item.topic}
              </span>
              {compact && tagInfo ? (
                <span
                  className={`text-[10px] font-bold border rounded px-1.5 py-0.5 shrink-0 ${tagInfo.border} ${tagInfo.bg} ${tagInfo.text}`}
                >
                  {tagInfo.label}
                </span>
              ) : tagLegacy ? (
                <span
                  className={`text-xs font-bold ${tagLegacy.color} shrink-0 bg-muted/40 px-2 py-0.5 rounded`}
                >
                  {tagLegacy.label}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
