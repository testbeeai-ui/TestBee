"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, ExternalLink, ArrowRight, Video, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  mergeClassroomLiveSessions,
  upcomingClassroomLiveSessions,
} from "@/lib/classroom/classroomLiveSessions";
import PostDetailModal, { type PostDetailData } from "@/components/PostDetailModal";

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

interface MembershipInfo {
  classroom_id: string;
  joined_at: string | null;
}

interface ClassesSectionProps {
  userId: string;
  onNextClass?: (info: { name: string; time: string } | null) => void;
  accessToken?: string | null;
  onClassCalendar?: () => void;
  viewAllHref?: string;
  onViewAllClick?: () => void;
}

function dateMs(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function createdMs(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareDueDates(a: string | null | undefined, b: string | null | undefined): number {
  const aTime = dateMs(a);
  const bTime = dateMs(b);
  const aHasDate = Number.isFinite(aTime);
  const bHasDate = Number.isFinite(bTime);
  if (!aHasDate && !bHasDate) return 0;
  if (!aHasDate) return 1;
  if (!bHasDate) return -1;
  return aTime - bTime;
}

function getAssignmentDueDate(assignment: any): string | null {
  const content = assignment.content_json as any;
  return content?.dueDate ?? assignment.due_date ?? null;
}

export default function ClassesSection({
  userId,
  onNextClass,
  accessToken,
  onClassCalendar,
  viewAllHref = "/classrooms",
  onViewAllClick,
}: ClassesSectionProps) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostDetailData | null>(null);
  const [teacherMap, setTeacherMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: memberships } = await supabase
        .from("classroom_members")
        .select("classroom_id, joined_at")
        .eq("user_id", userId);

      const membershipRows = (memberships ?? []) as MembershipInfo[];
      const joinedAtByClassroomId = new Map(
        membershipRows.map((membership) => [membership.classroom_id, membership.joined_at])
      );
      const classroomIds = membershipRows.map((m) => m.classroom_id);
      if (classroomIds.length === 0) {
        setLoading(false);
        onNextClass?.(null);
        return;
      }

      const [classRes, sessionRes, slotRes, postRes] = await Promise.all([
        supabase
          .from("classrooms")
          .select("id, name, subject, type, teacher_id")
          .in("id", classroomIds),
        supabase
          .from("live_sessions")
          .select("id, title, scheduled_at, duration_minutes, meet_link, status, classroom_id, section_id")
          .in("classroom_id", classroomIds)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(10),
        supabase
          .from("live_class_slots")
          .select("id, classroom_id, section_id, slot_at, duration_minutes, meet_link, status")
          .in("classroom_id", classroomIds)
          .eq("status", "scheduled")
          .gte("slot_at", new Date().toISOString())
          .order("slot_at", { ascending: true })
          .limit(10),
        supabase
          .from("posts")
          .select("id, title, content_json, type, created_at, classroom_id, description, tags, due_date, teacher_id, profiles!posts_teacher_id_fkey(name)")
          .in("classroom_id", classroomIds)
          .order("created_at", { ascending: false }),
      ]);

      const classList = classRes.data ?? [];
      const merged = mergeClassroomLiveSessions(sessionRes.data ?? [], slotRes.data ?? []);
      const sessionList = upcomingClassroomLiveSessions(merged).slice(0, 5) as SessionInfo[];
      const nearestSessionClassroomId = sessionList[0]?.classroom_id ?? null;
      const sortedClassList = [...classList].sort((a, b) => {
        if (nearestSessionClassroomId) {
          if (a.id === nearestSessionClassroomId) return -1;
          if (b.id === nearestSessionClassroomId) return 1;
        }
        return (
          createdMs(joinedAtByClassroomId.get(b.id) ?? null) -
          createdMs(joinedAtByClassroomId.get(a.id) ?? null)
        );
      });

      const teacherIds = [...new Set(sortedClassList.map((c) => c.teacher_id))];
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", teacherIds);
        const map = new Map((profiles ?? []).map((p) => [p.id, p.name ?? ""]));
        setTeacherMap(map);
      }

      setClasses(sortedClassList);
      setSessions(sessionList);

      // Report next class info to parent
      const firstSession = sessionList[0];
      if (firstSession) {
        const cls = sortedClassList.find((c) => c.id === firstSession.classroom_id);
        if (cls) {
          const d = new Date(firstSession.scheduled_at);
          const isToday = d.toDateString() === new Date().toDateString();
          const timeStr = d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
          onNextClass?.({
            name: cls.subject ?? cls.name,
            time: isToday
              ? `Today, ${timeStr}`
              : d.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }) + `, ${timeStr}`,
          });
        }
      } else {
        onNextClass?.(null);
      }

      // Filter and process assignments
      const postList = postRes.data ?? [];
      const assignmentPosts = postList.filter(
        (p) => p.type === "assignment" || p.type === "Concept Focus"
      );

      const postIds = assignmentPosts.map((p) => p.id);
      const completedMap = new Set<string>();

      if (postIds.length > 0) {
        const { data: progressRows } = await supabase
          .from("classroom_assignment_task_progress")
          .select("post_id, task_id")
          .eq("user_id", userId)
          .in("post_id", postIds);

        const grouped = new Map<string, Set<string>>();
        for (const r of progressRows ?? []) {
          const s = grouped.get(r.post_id) ?? new Set<string>();
          s.add(r.task_id);
          grouped.set(r.post_id, s);
        }

        for (const post of assignmentPosts) {
          const contentJson = post.content_json as any;
          const rawTasks = contentJson?.tasks ?? [];
          const taskIds = Array.isArray(rawTasks) ? rawTasks.map((t: any) => t.id) : [];
          if (taskIds.length === 0) continue;
          const doneSet = grouped.get(post.id) ?? new Set<string>();
          const allDone = taskIds.every((tid: string) => doneSet.has(tid));
          if (allDone) {
            completedMap.add(post.id);
          }
        }
      }

      const pendingList = assignmentPosts
        .filter((p) => !completedMap.has(p.id))
        .sort((a, b) => {
          const dueDiff = compareDueDates(getAssignmentDueDate(a), getAssignmentDueDate(b));
          if (dueDiff !== 0) return dueDiff;
          return createdMs(b.created_at) - createdMs(a.created_at);
        });
      setPendingAssignments(pendingList);

      setLoading(false);
    })();
  }, [userId]);

  const formatSessionTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const day = d.toLocaleDateString("en-US", { weekday: "short" });
    if (isToday) return `Today ${time}`;
    if (isTomorrow) return `Tomorrow ${time}`;
    return `${day} ${time}`;
  };

  // Primary classroom to show
  const primaryClass = classes[0] ?? {
    id: "demo-class-1",
    name: "JEE Batch 101",
    subject: "Physics",
    type: "syllabus",
    teacher_id: "teacher-1",
  };
  const primaryTeacher = teacherMap.get(primaryClass.teacher_id) || "Sankar";

  const displaySessions = sessions.slice(0, 2);

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" />
          Classes (Webinars)
        </h3>
        <Link
          href={viewAllHref}
          onClick={onViewAllClick}
          className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Classroom Block */}
      <Link href={`/classroom/${primaryClass.id}`}>
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-white/5 bg-[#111418]/60 hover:shadow-sm hover:border-zinc-800 transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground truncate">{primaryClass.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {primaryTeacher} · Live sessions every week
            </p>
          </div>
          <div className="shrink-0">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              Enrolled
            </span>
          </div>
        </div>
      </Link>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Upcoming Sessions Block */}
      <div className="space-y-2.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
          UPCOMING SESSIONS
        </span>
        <div className="space-y-2">
          {displaySessions.length > 0 ? (
            displaySessions.map((session, i) => (
              <div
                key={session.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#111418]/60"
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    i === 0 ? "bg-gradient-to-br from-blue-500/20 to-indigo-500/10 text-blue-400" : "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400"
                  )}
                >
                  <Video className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[12.5px] text-foreground truncate">{session.title}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">
                    {formatSessionTime(session.scheduled_at)} · {session.duration_minutes} min
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="text-xs font-bold text-blue-450 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                    Upcoming
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 rounded-xl border border-dashed border-zinc-800/40 text-xs text-muted-foreground">
              No upcoming sessions scheduled
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Pending Assignments Block */}
      <div className="space-y-2.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground block">
          PENDING ASSIGNMENTS
        </span>
        {pendingAssignments.length > 0 ? (
          <div className="space-y-2">
            {pendingAssignments.slice(0, 2).map((assignment) => {
              let dueDateText = "Due soon";
              const dueDate = getAssignmentDueDate(assignment);
              if (dueDate) {
                const d = new Date(dueDate);
                dueDateText = `Due: ${d.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' })}`;
              }
              return (
                <div
                  key={assignment.id}
                  onClick={() => setSelectedPost(assignment)}
                  className="cursor-pointer flex items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-[#111418]/60 hover:border-zinc-800 hover:shadow-sm transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/10 text-purple-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[12.5px] text-foreground truncate">{assignment.title}</p>
                    <p className="text-[10.5px] text-muted-foreground truncate">{dueDateText}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-zinc-700/60 hover:border-zinc-500 bg-transparent px-3.5 py-0.5 text-[10.5px] font-bold text-zinc-300 hover:text-white transition-colors"
                  >
                    Solve
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 rounded-xl border border-dashed border-zinc-800/40 text-xs text-muted-foreground">
            No pending assignments
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Footer */}
      <div className="flex items-center justify-end pt-1 text-xs">
        <Link
          href={`/classroom/${primaryClass.id}?tab=assignments`}
          className="font-bold text-blue-400 hover:underline flex items-center gap-1"
        >
          Browse assignments <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          canEdit={false}
          onUpdated={() => {}}
          classroomId={selectedPost.classroom_id}
        />
      )}
    </div>
  );
}
