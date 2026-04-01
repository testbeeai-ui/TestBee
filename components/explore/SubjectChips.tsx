'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Subject, ExamType } from '@/types';

const subjectList: { value: Subject; label: string; color: string; bg: string }[] = [
  { value: 'physics', label: 'Physics', color: 'text-blue-600', bg: 'bg-blue-500/10 border-blue-500/30' },
  { value: 'chemistry', label: 'Chemistry', color: 'text-purple-600', bg: 'bg-purple-500/10 border-purple-500/30' },
  { value: 'math', label: 'Mathematics', color: 'text-orange-600', bg: 'bg-orange-500/10 border-orange-500/30' },
];

const examOptions: { value: ExamType | null; label: string; emoji: string }[] = [
  { value: null, label: 'CBSE', emoji: '📘' },
  { value: 'JEE_Mains', label: 'JEE Mains', emoji: '🎯' },
  { value: 'JEE_Advance', label: 'JEE Advance', emoji: '🏆' },
  { value: 'KCET', label: 'KCET', emoji: '📋' },
  { value: 'other', label: 'Other', emoji: '📝' },
];

interface SubjectChipsProps {
  onSelectSubject: (subject: Subject, exam: ExamType | null) => void;
}

export default function SubjectChips({ onSelectSubject }: SubjectChipsProps) {
  const [pendingSubject, setPendingSubject] = useState<Subject | null>(null);

  return (
    <>
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Browse by subject</h3>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {subjectList.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setPendingSubject(s.value)}
              className={`inline-flex items-center px-4 py-2 rounded-full border text-sm font-semibold ${s.color} ${s.bg} hover:scale-105 transition-all whitespace-nowrap shrink-0`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!pendingSubject} onOpenChange={(open) => { if (!open) setPendingSubject(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Choose your exam</DialogTitle>
            <DialogDescription>
              Select your exam to see relevant {pendingSubject ? subjectList.find((s) => s.value === pendingSubject)?.label : ''} topics
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {examOptions.map((exam) => (
              <button
                key={exam.label}
                type="button"
                onClick={() => {
                  if (pendingSubject) {
                    onSelectSubject(pendingSubject, exam.value);
                    setPendingSubject(null);
                  }
                }}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm transition-all text-left group"
              >
                <span className="text-xl">{exam.emoji}</span>
                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {exam.label}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
