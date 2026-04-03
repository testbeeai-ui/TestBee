'use client';

import { ClipboardList, ArrowRight } from 'lucide-react';
import type { Subject } from '@/types';

const subjectConfig: Record<Subject, { badge: string; color: string; title: string; details: string }> = {
  physics: {
    badge: 'P',
    color: 'bg-blue-500',
    title: 'Physics Full Syllabus Mock',
    details: '90 mins · 36 Qs · Adaptive difficulty',
  },
  chemistry: {
    badge: 'C',
    color: 'bg-purple-500',
    title: 'Chemistry Full Syllabus Mock',
    details: '90 mins · 36 Qs · Adaptive difficulty',
  },
  math: {
    badge: 'M',
    color: 'bg-orange-500',
    title: 'Mathematics Full Syllabus Mock',
    details: '90 mins · 36 Qs · Adaptive difficulty',
  },
  biology: {
    badge: 'B',
    color: 'bg-green-500',
    title: 'Biology Full Syllabus Mock',
    details: '90 mins · 36 Qs · Adaptive difficulty',
  },
};

interface MockTestsSectionProps {
  subjects: Subject[];
  onStartMock: (subject: Subject) => void;
  onViewAll: () => void;
}

export default function MockTestsSection({ subjects, onStartMock, onViewAll }: MockTestsSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onViewAll} className="font-display font-bold text-foreground text-sm flex items-center gap-2 hover:text-primary transition-colors">
          <ClipboardList className="w-4 h-4 text-primary" />
          Mock tests
        </button>
        <button onClick={onViewAll} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2">
        {subjects.map((subj, i) => {
          const config = subjectConfig[subj];
          return (
            <div
              key={subj}
              className="edu-card p-3 rounded-xl border border-border/50 flex items-center gap-3 hover:shadow-sm transition-shadow"
            >
              <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center shrink-0`}>
                <span className="text-white font-extrabold text-sm">
                  {config.badge}{i + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{config.title}</p>
                <p className="text-xs text-muted-foreground">{config.details}</p>
              </div>
              <button
                onClick={() => onStartMock(subj)}
                className="text-primary text-xs font-extrabold hover:underline shrink-0 whitespace-nowrap"
              >
                Start →
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
