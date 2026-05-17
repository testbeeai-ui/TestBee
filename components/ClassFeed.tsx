import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Video,
  HelpCircle,
  ClipboardList,
  BarChart3,
  Megaphone,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { UserHoverCard } from "@/components/UserHoverCard";
import { format } from "date-fns";
import { getGyanEngagementStudentViewModel } from "@/lib/classroom/gyanEngagementStudentUi";
import { parseAssignmentTasks, studentVisibleTasks } from "@/lib/classroom/assignmentTasks";
import { isConceptFocusLessonChecklistComplete } from "@/lib/classroom/conceptFocusLessonCompletion";
import {
  CLASSROOM_ASSIGNMENT_PROGRESS_EVENT,
  type ClassroomAssignmentProgressDetail,
} from "@/lib/classroom/assignmentProgressSync";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

export interface Post {
  id: string;
  type: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  due_date: string | null;
  created_at: string;
  teacher_id: string;
  classroom_id?: string;
  /** When set, post is scoped to this teaching section (not whole class). */
  section_id?: string | null;
  content_json?:
    | { videoUrl?: string; tasks?: unknown; releaseAt?: string }
    | Record<string, unknown>
    | null;
  profiles: { name: string } | null;
}

export type FeedCountsPayload = {
  total: number;
  active: number;
  upcoming: number;
  done: number;
};

const typeConfig: Record<string, { icon: typeof FileText; emoji: string; color: string }> = {
  concept: { icon: FileText, emoji: "💡", color: "bg-blue-500/10 text-blue-600" },
  video: { icon: Video, emoji: "🎬", color: "bg-purple-500/10 text-purple-600" },
  quiz: { icon: HelpCircle, emoji: "❓", color: "bg-amber-500/10 text-amber-600" },
  assignment: { icon: ClipboardList, emoji: "📝", color: "bg-green-500/10 text-green-600" },
  mock: { icon: ClipboardList, emoji: "📋", color: "bg-emerald-500/10 text-emerald-700" },
  past_paper: { icon: ClipboardList, emoji: "📜", color: "bg-emerald-500/10 text-teal-700" },
  poll: { icon: BarChart3, emoji: "📊", color: "bg-pink-500/10 text-pink-600" },
  announcement: { icon: Megaphone, emoji: "📢", color: "bg-orange-500/10 text-orange-600" },
  "Concept Focus": { icon: FileText, emoji: "🎯", color: "bg-violet-500/10 text-violet-600" },
};

function getPostAudienceLabel(
  post: Post,
  sections: Array<{ id: string; name: string }>,
  viewerUserId: string | null
): string | null {
  if (post.section_id) {
    const name = sections.find((s) => s.id === post.section_id)?.name;
    return name ? `Assigned to ${name}` : "Section only";
  }
  const cj = post.content_json;
  if (cj && typeof cj === "object" && !Array.isArray(cj)) {
    const o = cj as Record<string, unknown>;
    if (o.assignToKind === "custom" && Array.isArray(o.targetStudentIds)) {
      const ids = o.targetStudentIds as string[];
      if (viewerUserId && ids.includes(viewerUserId)) return "Assigned to you";
      if (ids.length === 1) return "Assigned to 1 student";
      if (ids.length > 1) return `Assigned to ${ids.length} students`;
      return "Selected students only";
    }
  }
  return null;
}

function getReleaseMs(post: Post): number | null {
  const cj = post.content_json;
  if (!cj || typeof cj !== "object" || Array.isArray(cj)) return null;
  const raw = (cj as Record<string, unknown>).releaseAt;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

/** Same rules as legacy visiblePosts: teacher always sees own scheduled posts; others respect releaseAt. */
function isReleasedForViewer(
  post: Post,
  nowMs: number,
  currentUserId: string | null,
  viewerIsTeacher: boolean
): boolean {
  if (viewerIsTeacher && currentUserId && post.teacher_id === currentUserId) return true;
  const ms = getReleaseMs(post);
  if (ms === null) return true;
  return nowMs >= ms;
}

function withAssignmentTrackingParams(
  href: string,
  postId: string,
  classroomId: string,
  kind?: string
): string {
  if (!href) return href;
  if (!(kind === "chapter_quiz" || href.includes("panel=quiz"))) return href;
  try {
    const isAbsolute = /^https?:\/\//i.test(href);
    const url = isAbsolute ? new URL(href) : new URL(href, "https://edublast.local");
    if (!url.searchParams.get("postId")) url.searchParams.set("postId", postId);
    if (!url.searchParams.get("classroomId")) url.searchParams.set("classroomId", classroomId);
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

/** Whether every student-visible task for this post is satisfied (attempt row and/or task-progress ticks). */
function studentVisibleAssignmentIsDone(
  post: Post,
  completedForPost: Set<string>,
  submittedPostIds: Set<string>,
  subtopicEngagement: unknown
): boolean {
  if (post.type === "Concept Focus") {
    return (
      completedForPost.has("concept-focus-subtopic") ||
      isConceptFocusLessonChecklistComplete(subtopicEngagement, post.content_json)
    );
  }

  const tasks = studentVisibleTasks(
    parseAssignmentTasks((post.content_json as unknown as Json) ?? null, post.type)
  );
  if (tasks.length === 0) return false;

  for (const t of tasks) {
    if (t.kind === "chapter_quiz" || t.kind === "mock_paper" || t.kind === "past_paper") {
      if (completedForPost.has(t.id) || submittedPostIds.has(post.id)) continue;
      return false;
    }
    if (t.kind === "gyan_engagement") {
      if (!completedForPost.has(t.id)) return false;
      continue;
    }
    if (t.kind === "free_text" && !t.href && t.visible_to_student) {
      if (!completedForPost.has(t.id)) return false;
      continue;
    }
    if (
      t.kind === "bits" ||
      t.kind === "instacue" ||
      t.kind === "daily_dose" ||
      t.kind === "topic_path" ||
      t.kind === "external_link" ||
      (t.kind === "free_text" && t.href)
    ) {
      if (!completedForPost.has(t.id)) return false;
      continue;
    }
  }
  return true;
}

interface Props {
  classroomId: string;
  refreshKey?: number;
  onSelectPost?: (post: Post) => void;
  /** When set (e.g. from explorer-content API), use this instead of fetching from Supabase. */
  initialPosts?: Post[] | null;
  /** Teaching sections for resolving `section_id` into audience badges. */
  sectionOptions?: Array<{ id: string; name: string }>;
  /** True when the classroom owner/teacher is viewing (single combined feed, no student tabs). */
  viewerIsTeacher?: boolean;
  /** Enrolled student (not explorer): show section / RLS hint when the feed is empty. */
  isEnrolledStudent?: boolean;
  /** Fired when post list or partitioning changes so the parent can sync sidebar counts. */
  onFeedCountsChange?: (counts: FeedCountsPayload) => void;
}

type FeedTab = "active" | "upcoming" | "done";

const ClassFeed = ({
  classroomId,
  refreshKey,
  onSelectPost,
  initialPosts,
  sectionOptions = [],
  viewerIsTeacher = false,
  isEnrolledStudent = false,
  onFeedCountsChange,
}: Props) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittedPostIds, setSubmittedPostIds] = useState<Set<string>>(new Set());
  const [donePostIds, setDonePostIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [feedTab, setFeedTab] = useState<FeedTab>("active");
  /** Bumped when a student completes a linked assignment from the topic page so Done/Active tabs refresh. */
  const [assignmentProgressBump, setAssignmentProgressBump] = useState(0);
  const onFeedCountsChangeRef = useRef(onFeedCountsChange);
  useEffect(() => {
    onFeedCountsChangeRef.current = onFeedCountsChange;
  }, [onFeedCountsChange]);

  useEffect(() => {
    if (initialPosts !== undefined) {
      queueMicrotask(() => {
        setPosts(initialPosts ?? []);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => {
      setLoading(true);
      supabase
        .from("posts")
        .select("*, profiles!posts_teacher_id_fkey(name)")
        .eq("classroom_id", classroomId)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setPosts((data as unknown as Post[]) || []);
          setLoading(false);
        });
    });
  }, [classroomId, refreshKey, initialPosts]);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchSubmittedAttempts = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const genericClient = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string
            ) => {
              eq: (
                column: string,
                value: string
              ) => {
                not: (
                  column: string,
                  operator: string,
                  value: null
                ) => Promise<{
                  data: { post_id: string; submitted_at: string }[] | null;
                  error: null;
                }>;
              };
            };
          };
        };
      };
      const attempts = await genericClient
        .from("classroom_generated_test_attempts")
        .select("post_id, submitted_at")
        .eq("classroom_id", classroomId)
        .eq("user_id", user.id)
        .not("submitted_at", "is", null);
      const submittedIds = new Set(attempts.data?.map((a: { post_id: string }) => a.post_id) || []);
      setSubmittedPostIds(submittedIds);
    };
    void fetchSubmittedAttempts();
  }, [classroomId, assignmentProgressBump, refreshKey]);

  useEffect(() => {
    const fetchTaskProgressDone = async () => {
      if (viewerIsTeacher) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const assignmentLike = posts.filter(
        (p) =>
          p.type === "assignment" ||
          p.type === "quiz" ||
          p.type === "mock" ||
          p.type === "past_paper" ||
          p.type === "Concept Focus"
      );
      if (assignmentLike.length === 0) {
        setDonePostIds(new Set(submittedPostIds));
        return;
      }
      const postIds = assignmentLike.map((p) => p.id);

      let subtopicEngagement: unknown = null;
      if (posts.some((p) => p.type === "Concept Focus")) {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("subtopic_engagement")
          .eq("id", user.id)
          .maybeSingle();
        subtopicEngagement = profileRow?.subtopic_engagement ?? null;
      }

      const genericClient = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              in: (column: string, values: string[]) => Promise<{
                data: Array<{ post_id: string; task_id: string }> | null;
                error: { message?: string } | null;
              }>;
            };
          };
        };
      };

      const { data: rows } = await genericClient
        .from("classroom_assignment_task_progress")
        .select("post_id, task_id")
        .eq("user_id", user.id)
        .in("post_id", postIds);

      const completedByPost = new Map<string, Set<string>>();
      for (const r of rows ?? []) {
        const set = completedByPost.get(r.post_id) ?? new Set<string>();
        set.add(r.task_id);
        completedByPost.set(r.post_id, set);
      }

      const done = new Set<string>();
      for (const p of assignmentLike) {
        const completed = completedByPost.get(p.id) ?? new Set<string>();
        if (
          studentVisibleAssignmentIsDone(p, completed, submittedPostIds, subtopicEngagement)
        ) {
          done.add(p.id);
        }
      }

      setDonePostIds(done);
    };
    void fetchTaskProgressDone();
  }, [
    classroomId,
    posts,
    submittedPostIds,
    viewerIsTeacher,
    assignmentProgressBump,
    refreshKey,
  ]);

  useEffect(() => {
    if (viewerIsTeacher) return;
    const onProgress = (ev: Event) => {
      const d = (ev as CustomEvent<ClassroomAssignmentProgressDetail>).detail;
      if (!d || d.classroomId !== classroomId) return;
      setAssignmentProgressBump((n) => n + 1);
    };
    window.addEventListener(CLASSROOM_ASSIGNMENT_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(CLASSROOM_ASSIGNMENT_PROGRESS_EVENT, onProgress);
  }, [classroomId, viewerIsTeacher]);

  const visiblePosts = useMemo(() => {
    // Students should see reminders only in Notifications, not inside Posts feed.
    const base = posts.filter((post) => isReleasedForViewer(post, nowMs, currentUserId, viewerIsTeacher));
    return viewerIsTeacher ? base : base.filter((p) => p.type !== "motivation");
  }, [posts, currentUserId, nowMs, viewerIsTeacher]);

  const upcomingPosts = useMemo(() => {
    if (viewerIsTeacher) return [];
    return posts
      .filter((post) => {
        const ms = getReleaseMs(post);
        return ms !== null && nowMs < ms;
      })
      .sort((a, b) => (getReleaseMs(a) ?? 0) - (getReleaseMs(b) ?? 0));
  }, [posts, nowMs, viewerIsTeacher]);

  const activePosts = useMemo(() => {
    if (viewerIsTeacher) return visiblePosts;
    return visiblePosts.filter((p) => !donePostIds.has(p.id));
  }, [visiblePosts, donePostIds, viewerIsTeacher]);

  const donePosts = useMemo(() => {
    if (viewerIsTeacher) return [];
    return visiblePosts.filter((p) => donePostIds.has(p.id));
  }, [visiblePosts, donePostIds, viewerIsTeacher]);

  useEffect(() => {
    if (!onFeedCountsChangeRef.current || loading) return;
    onFeedCountsChangeRef.current({
      total: posts.length,
      active: viewerIsTeacher ? visiblePosts.length : activePosts.length,
      upcoming: upcomingPosts.length,
      done: donePosts.length,
    });
  }, [
    posts.length,
    visiblePosts.length,
    activePosts.length,
    upcomingPosts.length,
    donePosts.length,
    viewerIsTeacher,
    loading,
  ]);

  const selectedPosts = useMemo(() => {
    if (viewerIsTeacher) return visiblePosts;
    if (feedTab === "upcoming") return upcomingPosts;
    if (feedTab === "done") return donePosts;
    return activePosts;
  }, [viewerIsTeacher, feedTab, visiblePosts, upcomingPosts, donePosts, activePosts]);

  const renderPostCard = useCallback(
    (post: Post) => {
      const cfg = typeConfig[post.type] || typeConfig.announcement;
      const gyanStudent = getGyanEngagementStudentViewModel(
        (post.content_json as unknown as import("@/integrations/supabase/types").Json) ?? null,
        post.type
      );
      const releaseMs = getReleaseMs(post);
      const isUpcomingCard = !viewerIsTeacher && releaseMs !== null && nowMs < releaseMs;
      const isDone = !viewerIsTeacher && donePostIds.has(post.id);

      const cardContent = (
        <div className="flex flex-col h-full text-left">
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cfg.color}`}
            >
              {cfg.emoji}
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {gyanStudent ? `${post.type} · Gyan++` : post.type}
            </span>
            {isDone ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> Done
              </span>
            ) : null}
          </div>
          {(() => {
            const audience = getPostAudienceLabel(post, sectionOptions, currentUserId);
            if (!audience) return null;
            return (
              <span className="mb-2 inline-flex w-fit max-w-full rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold leading-tight text-amber-950 dark:text-amber-100">
                {audience}
              </span>
            );
          })()}
          {isUpcomingCard && releaseMs !== null && (
            <p className="mb-2 text-[10px] font-bold text-sky-700 dark:text-sky-200">
              Unlocks {format(new Date(releaseMs), "MMM d, h:mm a")}
            </p>
          )}
          <h4 className="font-extrabold text-foreground text-sm leading-tight line-clamp-2 mb-1">
            {post.title}
          </h4>
          {gyanStudent ? (
            <div className="flex-1 min-h-0 space-y-1.5">
              <p className="text-[11px] font-semibold leading-snug text-violet-300 line-clamp-2">
                Post your doubt on Gyan++ to complete this assignment.
              </p>
              <p className="text-xs text-muted-foreground line-clamp-3 leading-snug">
                {gyanStudent.taskLabel}
              </p>
              <p className="text-[10px] text-muted-foreground/90">
                Tap the card for steps and the open button.
              </p>
            </div>
          ) : post.description ? (
            <p className="text-xs text-muted-foreground line-clamp-2 flex-1 min-h-0">
              {post.description}
            </p>
          ) : null}
          {(() => {
            const tasks = studentVisibleTasks(
              parseAssignmentTasks(
                (post.content_json as unknown as import("@/integrations/supabase/types").Json) ?? null,
                post.type
              )
            );
            const linkTask = tasks.find((t) => t.href && t.visible_to_student);
            if (!linkTask) return null;
            if (post.type === "Concept Focus" && isDone) return null;
            const trackedHref = withAssignmentTrackingParams(
              linkTask.href!,
              post.id,
              classroomId,
              linkTask.kind
            );
            const isExternal = /^https?:\/\//i.test(linkTask.href ?? "");
            const isNewTab =
              isExternal ||
              linkTask.href?.includes("/assignment-test/") ||
              linkTask.href?.includes("panel=quiz");
            const primaryCtaLabel = post.type === "Concept Focus" ? "Open lesson" : "Open link";
            return (
              <div className="mt-2 flex items-center gap-2">
                {isNewTab ? (
                  <a
                    href={trackedHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {primaryCtaLabel}
                  </a>
                ) : (
                  <span
                    className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = trackedHref;
                    }}
                  >
                    {primaryCtaLabel}
                  </span>
                )}
              </div>
            );
          })()}
          {post.due_date && (
            <p className="text-[10px] font-bold text-destructive flex items-center gap-0.5 mt-2">
              <Calendar className="w-3 h-3 shrink-0" /> Due {format(new Date(post.due_date), "MMM d")}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/70 mt-auto pt-3">
            <UserHoverCard userId={post.teacher_id}>
              <span className="font-medium hover:text-primary hover:underline cursor-pointer">
                {post.profiles?.name || "Teacher"}
              </span>
            </UserHoverCard>
            {" · "}
            {format(new Date(post.created_at), "MMM d")}
          </p>
        </div>
      );

      const cardClass = `edu-card rounded-xl p-3 transition-all flex flex-col hover:border-primary/30 hover:shadow-md sm:rounded-2xl sm:p-5 ${
        gyanStudent ? "min-h-[180px] sm:min-h-[220px]" : "min-h-[140px] sm:min-h-[180px]"
      }`;
      return (
        <div key={post.id} className="flex">
          {onSelectPost ? (
            <button
              type="button"
              onClick={() => onSelectPost(post)}
              className={`${cardClass} w-full cursor-pointer text-left`}
            >
              {cardContent}
            </button>
          ) : (
            <div className={`${cardClass} w-full`}>{cardContent}</div>
          )}
        </div>
      );
    },
    [
      classroomId,
      currentUserId,
      nowMs,
      onSelectPost,
      sectionOptions,
      donePostIds,
      viewerIsTeacher,
    ]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="edu-card rounded-2xl p-5 min-h-[180px] animate-pulse bg-muted/30"
          />
        ))}
      </div>
    );
  }

  // Teacher: legacy single empty message when nothing visible
  if (viewerIsTeacher && visiblePosts.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-3">📝</span>
        <p className="text-muted-foreground text-sm">
          No posts yet. Teachers can create the first post!
        </p>
      </div>
    );
  }

  // Student / explorer: differentiate empty fetch vs all scheduled vs normal
  if (!viewerIsTeacher && posts.length === 0) {
    return (
      <div className="text-center py-12 space-y-3 px-2">
        <span className="text-4xl block mb-1">📝</span>
        <p className="text-muted-foreground text-sm font-medium">
          No posts are visible to you in this class yet.
        </p>
        {isEnrolledStudent ? (
          <ul className="text-xs text-muted-foreground max-w-md mx-auto space-y-1.5 text-left list-disc pl-5">
            <li>You only see posts your account is allowed to read (same rules as the database).</li>
            <li>
              Section-only work: your <span className="font-semibold text-foreground">Members</span> teaching section
              must match the post&apos;s section.
            </li>
            <li>If you were moved after work was published, ask your teacher to fix scope or republish.</li>
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Join the class to see section-specific work. Preview may only show class-wide content.
          </p>
        )}
      </div>
    );
  }

  if (!viewerIsTeacher && posts.length > 0 && visiblePosts.length === 0 && upcomingPosts.length > 0) {
    const next = upcomingPosts[0];
    const nextMs = getReleaseMs(next);
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-950 dark:text-sky-100">
          <p className="font-bold">Everything here is scheduled for later.</p>
          <p className="mt-1 text-xs opacity-90">
            {upcomingPosts.length} item{upcomingPosts.length === 1 ? "" : "s"} unlock
            {nextMs ? ` starting ${format(new Date(nextMs), "MMM d, h:mm a")}` : " soon"}.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">{upcomingPosts.map(renderPostCard)}</div>
      </div>
    );
  }

  if (!viewerIsTeacher && posts.length > 0 && visiblePosts.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <span className="text-4xl block mb-2">📝</span>
        <p className="text-muted-foreground text-sm">Nothing is available to open right now.</p>
      </div>
    );
  }

  const tabBar =
    !viewerIsTeacher && (upcomingPosts.length > 0 || donePosts.length > 0) ? (
      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            { id: "active" as const, label: "Active", count: activePosts.length },
            { id: "upcoming" as const, label: "Upcoming", count: upcomingPosts.length },
            { id: "done" as const, label: "Done", count: donePosts.length },
          ] satisfies { id: FeedTab; label: string; count: number }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFeedTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold transition-colors border",
              feedTab === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count > 0 ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>
    ) : null;

  const tabEmptyHint =
    !viewerIsTeacher && selectedPosts.length === 0 ? (
      <div className="mb-4 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-center text-xs text-muted-foreground">
        {feedTab === "active" && upcomingPosts.length > 0 && (
          <button
            type="button"
            className="font-bold text-primary underline-offset-2 hover:underline"
            onClick={() => setFeedTab("upcoming")}
          >
            {upcomingPosts.length} upcoming — show scheduled items
          </button>
        )}
        {feedTab === "active" && upcomingPosts.length === 0 && donePosts.length > 0 && (
          <span>Nothing open right now. Check the Done tab for completed work.</span>
        )}
        {feedTab === "active" && upcomingPosts.length === 0 && donePosts.length === 0 && (
          <span>You are caught up — no open items.</span>
        )}
        {feedTab === "upcoming" && <span>No scheduled posts right now.</span>}
        {feedTab === "done" && <span>No submitted items tracked here yet.</span>}
      </div>
    ) : null;

  return (
    <div className="space-y-1">
      {tabBar}
      {tabEmptyHint}
      {selectedPosts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {selectedPosts.map(renderPostCard)}
        </div>
      ) : null}
    </div>
  );
};

export default ClassFeed;
