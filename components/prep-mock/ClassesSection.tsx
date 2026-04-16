'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/integrations/supabase/client';
import { GraduationCap, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { incrementPrepCalendarDay, localDayISO } from '@/lib/prepCalendarClient';

interface ClassInfo {
  id: string;
  name: string;
  subject: string | null;
  type: string;
  teacher_id: string;
}

interface SessionInfo {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meet_link: string | null;
  status: string;
  classroom_id: string;
}

interface ClassesSectionProps {
  userId: string;
  onNextClass?: (info: { name: string; time: string } | null) => void;
  accessToken?: string | null;
  onClassCalendar?: () => void;
}

const classGradients = [
  'from-blue-500 to-cyan-500',
  'from-purple-500 to-violet-500',
  'from-orange-500 to-amber-500',
];

export default function ClassesSection({ userId, onNextClass, accessToken, onClassCalendar }: ClassesSectionProps) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [teacherMap, setTeacherMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: memberships } = await supabase
        .from('classroom_members')
        .select('classroom_id')
        .eq('user_id', userId);

      const classroomIds = (memberships ?? []).map((m) => m.classroom_id);
      if (classroomIds.length === 0) {
        setLoading(false);
        onNextClass?.(null);
        return;
      }

      const [classRes, sessionRes] = await Promise.all([
        supabase
          .from('classrooms')
          .select('id, name, subject, type, teacher_id')
          .in('id', classroomIds)
          .limit(3),
        supabase
          .from('live_sessions')
          .select('id, title, scheduled_at, duration_minutes, meet_link, status, classroom_id')
          .in('classroom_id', classroomIds)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(10),
      ]);

      const classList = classRes.data ?? [];
      const sessionList = sessionRes.data ?? [];

      // Fetch teacher names
      const teacherIds = [...new Set(classList.map((c) => c.teacher_id))];
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', teacherIds);
        const map = new Map((profiles ?? []).map((p) => [p.id, p.name ?? '']));
        setTeacherMap(map);
      }

      setClasses(classList);
      setSessions(sessionList);

      // Report next class info to parent
      const firstSession = sessionList[0];
      if (firstSession) {
        const cls = classList.find((c) => c.id === firstSession.classroom_id);
        if (cls) {
          const d = new Date(firstSession.scheduled_at);
          const isToday = d.toDateString() === new Date().toDateString();
          const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          onNextClass?.({
            name: cls.subject ?? cls.name,
            time: isToday ? `Today, ${timeStr}` : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + `, ${timeStr}`,
          });
        }
      } else {
        onNextClass?.(null);
      }

      setLoading(false);
    })();
  }, [userId]);

  const getSessionForClass = (classroomId: string) =>
    sessions.find((s) => s.classroom_id === classroomId);

  const getStatus = (session: SessionInfo | undefined): 'live' | 'upcoming' | 'recorded' | null => {
    if (!session) return null;
    const start = new Date(session.scheduled_at).getTime();
    const end = start + session.duration_minutes * 60 * 1000;
    const now = Date.now();
    if (now >= start && now <= end) return 'live';
    if (now < start) return 'upcoming';
    return 'recorded';
  };

  const formatSessionTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    if (isToday) return `Today ${time}`;
    if (isTomorrow) return `Tomorrow ${time}`;
    return `${day} ${time}`;
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/classrooms" className="font-display font-bold text-foreground text-sm flex items-center gap-2 hover:text-primary transition-colors">
          <GraduationCap className="w-4 h-4 text-primary" />
          Classes (Webinars)
        </Link>
        <Link href="/classrooms" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="edu-card p-3 rounded-xl border border-border/50 animate-pulse flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-2.5 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="edu-card p-5 rounded-xl border border-dashed border-border text-center">
          <GraduationCap className="w-9 h-9 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground mb-1">No classes yet</p>
          <p className="text-xs text-muted-foreground mb-3">
            Join a classroom to see your upcoming webinars here.
          </p>
          <Link href="/classrooms">
            <Button size="sm" className="rounded-lg edu-btn-primary text-xs">
              Explore Classes <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map((cls, i) => {
            const session = getSessionForClass(cls.id);
            const status = getStatus(session);
            const teacherName = teacherMap.get(cls.teacher_id);

            return (
              <Link key={cls.id} href={`/classroom/${cls.id}`}>
                <div className="edu-card p-3 rounded-xl border border-border/50 hover:shadow-sm transition-shadow flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${classGradients[i % classGradients.length]} flex items-center justify-center shrink-0`}>
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{cls.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {teacherName ? `${teacherName}` : cls.subject ?? cls.type}
                      {session && ` · ${formatSessionTime(session.scheduled_at)}`}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {status === 'live' ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Live soon
                      </span>
                    ) : status === 'upcoming' ? (
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        Upcoming
                      </span>
                    ) : status === 'recorded' ? (
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        Recorded
                      </span>
                    ) : null}
                  </div>
                  {status === 'live' && session?.meet_link && (
                    <a
                      href={session.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!userId) return;
                        const day = localDayISO();
                        const k = `prep_cal_class_${userId}_${day}`;
                        if (typeof window !== 'undefined' && sessionStorage.getItem(k)) return;
                        void incrementPrepCalendarDay(accessToken ?? undefined, 'class', day).then((ok) => {
                          if (ok && typeof window !== 'undefined') sessionStorage.setItem(k, '1');
                          if (ok) onClassCalendar?.();
                        });
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
