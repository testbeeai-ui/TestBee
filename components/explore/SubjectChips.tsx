'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Subject, ExamType, ClassLevel } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { examTypeToTargetExam } from '@/lib/targetExam';
import { cn } from '@/lib/utils';

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

const STUDENT_COMING_SOON_EXAMS = new Set<ExamType>(['JEE_Mains', 'JEE_Advance', 'KCET', 'other']);

interface SubjectChipsProps {
  onSelectSubject: (subject: Subject, exam: ExamType | null) => void;
}

export default function SubjectChips({ onSelectSubject }: SubjectChipsProps) {
  const [pendingSubject, setPendingSubject] = useState<Subject | null>(null);
  const [dialogClass, setDialogClass] = useState<ClassLevel>(11);
  const { user, profile, refreshProfile } = useAuth();

  useEffect(() => {
    if (!pendingSubject) return;
    const cl = profile?.class_level;
    setDialogClass(cl === 12 ? 12 : 11);
  }, [pendingSubject, profile?.class_level]);

  const persistStudentPrefs = async (exam: ExamType | null) => {
    if (!user?.id || profile?.role !== 'student') return;
    const target_exam = examTypeToTargetExam(exam);
    const { error } = await supabase
      .from('profiles')
      .update({ class_level: dialogClass, target_exam })
      .eq('id', user.id);
    if (!error) await refreshProfile();
  };

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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Choose your exam</DialogTitle>
            <DialogDescription>
              Select your exam to see relevant {pendingSubject ? subjectList.find((s) => s.value === pendingSubject)?.label : ''}{' '}
              topics
            </DialogDescription>
          </DialogHeader>

          {profile?.role === 'student' && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-extrabold text-foreground uppercase tracking-wide">Class</p>
              <div className="flex rounded-xl border border-border/80 bg-muted/40 p-1 gap-1">
                {([11, 12] as const).map((cl) => (
                  <button
                    key={cl}
                    type="button"
                    onClick={() => setDialogClass(cl)}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-sm font-extrabold transition-all',
                      dialogClass === cl
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                    )}
                  >
                    Class {cl}th
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-2">
            {examOptions.map((exam) => {
              const isAdmin = profile?.role === 'admin';
              const isComingSoonForUser =
                !isAdmin && exam.value !== null && STUDENT_COMING_SOON_EXAMS.has(exam.value);
              return (
                <button
                  key={exam.label}
                  type="button"
                  disabled={isComingSoonForUser}
                  onClick={async () => {
                    if (!pendingSubject || isComingSoonForUser) return;
                    await persistStudentPrefs(exam.value);
                    onSelectSubject(pendingSubject, exam.value);
                    setPendingSubject(null);
                  }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                    isComingSoonForUser
                      ? "border-border/60 bg-muted/30 text-muted-foreground cursor-not-allowed opacity-75"
                      : "border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                  )}
                >
                  <span className="text-xl">{exam.emoji}</span>
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        isComingSoonForUser ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                      )}
                    >
                      {exam.label}
                    </span>
                    {isComingSoonForUser && (
                      <span className="text-[11px] font-medium text-amber-500">Coming Soon</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
