"use client";

import { ClipboardList, ArrowRight } from "lucide-react";
import type { PastPaper, Subject } from "@/types";
import { cn } from "@/lib/utils";

const subjectConfig: Record<
  Subject,
  { badge: string; color: string; title: string; details: string }
> = {
  physics: {
    badge: "P",
    color: "bg-blue-500",
    title: "Physics Full Syllabus Mock",
    details: "90 mins · 36 Qs · Adaptive difficulty",
  },
  chemistry: {
    badge: "C",
    color: "bg-purple-500",
    title: "Chemistry Full Syllabus Mock",
    details: "90 mins · 36 Qs · Adaptive difficulty",
  },
  math: {
    badge: "M",
    color: "bg-orange-500",
    title: "Mathematics Full Syllabus Mock",
    details: "90 mins · 36 Qs · Adaptive difficulty",
  },
};

function featuredPaperDetails(p: PastPaper): string {
  return `${p.durationMinutes} mins · ${p.questionsCount} Qs · ${p.totalMarks} marks · Class ${p.classLevel} · PYQ`;
}

function MockTestRow({
  badgeLabel,
  badgeClassName,
  title,
  details,
  onStart,
}: {
  badgeLabel: string;
  badgeClassName: string;
  title: string;
  details: string;
  onStart: () => void;
}) {
  return (
    <div
      className={cn(
        "edu-card p-3 rounded-xl border border-border/50 flex items-center gap-3 hover:shadow-sm transition-shadow"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-extrabold text-sm",
          badgeClassName
        )}
      >
        {badgeLabel}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{details}</p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="text-primary text-xs font-extrabold hover:underline shrink-0 whitespace-nowrap"
      >
        Start →
      </button>
    </div>
  );
}

interface MockTestsSectionProps {
  subjects: Subject[];
  onStartMock: (subject: Subject) => void;
  onViewAll: () => void;
  /** When set, replaces the Physics quick row and opens NTA General Instructions on Start. */
  featuredPaper: PastPaper | null;
  featuredLoading?: boolean;
  onStartFeaturedPaper: () => void;
}

export default function MockTestsSection({
  subjects,
  onStartMock,
  onViewAll,
  featuredPaper,
  featuredLoading,
  onStartFeaturedPaper,
}: MockTestsSectionProps) {
  const hidePhysicsRow = Boolean(featuredPaper || featuredLoading);
  const listSubjects = hidePhysicsRow ? subjects.filter((s) => s !== "physics") : subjects;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onViewAll}
          className="font-display font-bold text-foreground text-sm flex items-center gap-2 hover:text-primary transition-colors"
        >
          <ClipboardList className="w-4 h-4 text-primary" />
          Mock tests
        </button>
        <button
          onClick={onViewAll}
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        {featuredLoading ? (
          <div className="edu-card p-3 rounded-xl border border-border/50 flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
            <div className="flex-1 min-w-0 space-y-2 py-0.5">
              <div className="h-4 max-w-[min(100%,18rem)] rounded bg-muted" />
              <div className="h-3 max-w-[min(100%,14rem)] rounded bg-muted" />
            </div>
            <div className="h-4 w-14 rounded bg-muted shrink-0" />
          </div>
        ) : null}

        {!featuredLoading && featuredPaper ? (
          <MockTestRow
            badgeLabel="J1"
            badgeClassName="bg-sky-600"
            title={featuredPaper.title}
            details={featuredPaperDetails(featuredPaper)}
            onStart={onStartFeaturedPaper}
          />
        ) : null}

        {listSubjects.map((subj, i) => {
          const config = subjectConfig[subj];
          const badgeNum = hidePhysicsRow ? i + 2 : i + 1;
          return (
            <MockTestRow
              key={subj}
              badgeLabel={`${config.badge}${badgeNum}`}
              badgeClassName={config.color}
              title={config.title}
              details={config.details}
              onStart={() => onStartMock(subj)}
            />
          );
        })}
      </div>
    </section>
  );
}
