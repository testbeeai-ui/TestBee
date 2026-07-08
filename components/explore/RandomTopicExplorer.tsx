"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, ArrowRight, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TopicNode } from "@/data/topicTaxonomy";
import type { Subject } from "@/types"; // used for subjectBadge/subjectLabel keys
import { cn } from "@/lib/utils";

const subjectBadge: Record<Subject, { bg: string; text: string }> = {
  physics: { bg: "bg-blue-500/15", text: "text-blue-700" },
  chemistry: { bg: "bg-purple-500/15", text: "text-purple-700" },
  math: { bg: "bg-orange-500/15", text: "text-orange-700" },
};

const subjectLabel: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Math",
};

function buildDescription(node: TopicNode): string {
  if (node.subtopics.length === 0) return `Explore ${node.topic} in ${subjectLabel[node.subject]}.`;
  const names = node.subtopics.map((s) => s.name);
  if (names.length <= 3) return `Covers ${names.join(", ")}.`;
  return `Covers ${names.slice(0, 3).join(", ")}, and real-world applications.`;
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
  compact?: boolean;
  noCardWrapper?: boolean;
}

export default function RandomTopicExplorer({
  taxonomy,
  onExploreTopic,
  compact = false,
  noCardWrapper = false,
}: RandomTopicExplorerProps) {
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

  const badgeBgClass = compact
    ? current.subject === "math"
      ? "border border-orange-500/30 bg-orange-500/5 text-orange-400"
      : current.subject === "physics"
        ? "border border-blue-500/30 bg-blue-500/5 text-blue-400"
        : "border border-purple-500/30 bg-purple-500/5 text-purple-400"
    : `border-0 ${badge.bg} ${badge.text}`;

  const chapterBadgeClass = compact
    ? "border border-border/50 bg-transparent text-muted-foreground"
    : "border-0 bg-muted/60 text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.35 }}
      className={cn(
        noCardWrapper
          ? "bg-transparent border-0 p-0 shadow-none"
          : cn("rounded-xl border border-border bg-card", compact ? "p-3.5" : "p-4 sm:p-5")
      )}
    >
      {!compact && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-foreground sm:text-base">Random topic explorer</h3>
          <button
            type="button"
            onClick={shuffle}
            className="rounded-lg p-1.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
            title="Show another topic"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={current.topic}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {/* Title */}
          <h4
            className={cn(
              "text-foreground leading-tight mb-2.5",
              compact ? "text-[13.5px] font-bold truncate" : "text-lg font-extrabold"
            )}
            title={buildTitle(current)}
          >
            {buildTitle(current)}
          </h4>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-3">
            <Badge
              variant="outline"
              className={`text-[11px] font-bold capitalize ${badgeBgClass}`}
            >
              {subjectLabel[current.subject]}
            </Badge>
            {chapterNum && (
              <Badge
                variant="outline"
                className={`text-[11px] font-bold ${chapterBadgeClass}`}
              >
                {chapterNum}
              </Badge>
            )}
            {compact && (
              <button
                type="button"
                onClick={shuffle}
                className="ml-auto rounded-lg p-1 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
                title="Show another topic"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Description - hide in compact mode */}
          {!compact && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-4 sm:text-sm sm:mb-5">
              {buildDescription(current)}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Actions row */}
      {compact ? (
        <div className="flex items-center gap-4 pt-1">
          <button
            type="button"
            onClick={() => onExploreTopic(current)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md active:scale-[0.98] transition-all"
          >
            Explore topic
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <Link
            href="/doubts"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors py-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Ask doubt
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <button
            type="button"
            onClick={() => onExploreTopic(current)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline py-2.5 sm:text-sm"
          >
            Explore topic
          </button>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/doubts"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2.5 sm:text-sm"
            >
              Ask doubt
            </Link>
            <button
              type="button"
              onClick={shuffle}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-2.5 sm:text-sm"
            >
              Shuffle
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
