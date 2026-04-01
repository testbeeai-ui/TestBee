'use client';

import { motion } from 'framer-motion';
import { Flame, Coins, BookOpen, HelpCircle } from 'lucide-react';
import type { ExploreStats } from '@/hooks/useExploreHubData';

const statItems = [
  { key: 'streak', label: 'Study streak', unit: 'days', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { key: 'rdm', label: 'RDM earned', unit: 'tokens', icon: Coins, color: 'text-yellow-600', bg: 'bg-yellow-500/10' },
  { key: 'topics', label: 'Topics explored', unit: 'this month', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'doubts', label: 'Doubts solved', unit: 'via Gyan++', icon: HelpCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
] as const;

function getValue(stats: ExploreStats, key: string): number {
  switch (key) {
    case 'streak': return stats.streakDays;
    case 'rdm': return stats.rdmEarned;
    case 'topics': return stats.topicsExplored;
    case 'doubts': return stats.doubtsSolved;
    default: return 0;
  }
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export default function ExploreStatsBar({ stats, loading }: { stats: ExploreStats; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {statItems.map((item, i) => {
        const Icon = item.icon;
        const value = getValue(stats, item.key);
        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            className="edu-card rounded-xl p-3 sm:p-4 border border-border"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${item.color}`} />
              </div>
            </div>
            {loading ? (
              <div className="h-8 w-16 rounded bg-muted animate-pulse" />
            ) : (
              <div className="text-xl sm:text-2xl font-extrabold text-foreground leading-none">
                {formatNumber(value)}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1">{item.unit}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
