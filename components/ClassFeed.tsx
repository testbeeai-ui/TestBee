import { useEffect, useMemo, useState } from "react";
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
  content_json?:
    | { videoUrl?: string; tasks?: unknown; releaseAt?: string }
    | Record<string, unknown>
    | null;
  profiles: { name: string } | null;
}

const typeConfig: Record<string, { icon: typeof FileText; emoji: string; color: string }> = {
  concept: { icon: FileText, emoji: "💡", color: "bg-blue-500/10 text-blue-600" },
  video: { icon: Video, emoji: "🎬", color: "bg-purple-500/10 text-purple-600" },
  quiz: { icon: HelpCircle, emoji: "❓", color: "bg-amber-500/10 text-amber-600" },
  assignment: { icon: ClipboardList, emoji: "📝", color: "bg-green-500/10 text-green-600" },
  mock: { icon: ClipboardList, emoji: "📋", color: "bg-emerald-500/10 text-emerald-700" },
  poll: { icon: BarChart3, emoji: "📊", color: "bg-pink-500/10 text-pink-600" },
  announcement: { icon: Megaphone, emoji: "📢", color: "bg-orange-500/10 text-orange-600" },
  "Concept Focus": { icon: FileText, emoji: "🎯", color: "bg-violet-500/10 text-violet-600" },
};

interface Props {
  classroomId: string;
  refreshKey?: number;
  onSelectPost?: (post: Post) => void;
  /** When set (e.g. from explorer-content API), use this instead of fetching from Supabase. */
  initialPosts?: Post[] | null;
}

function withAssignmentTrackingParams(
  href: string,
  postId: string,
  classroomId: string,
  kind?: string
): string {
  if (!href) return href;
  // Force tracking params on chapter-quiz style links opened from cards.
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

const ClassFeed = ({ classroomId, refreshKey, onSelectPost, initialPosts }: Props) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittedPostIds, setSubmittedPostIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

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
  }, [classroomId]);

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      const releaseAtRaw =
        post.content_json &&
        typeof post.content_json === "object" &&
        !Array.isArray(post.content_json)
          ? (post.content_json as Record<string, unknown>).releaseAt
          : null;

      if (typeof releaseAtRaw !== "string" || !releaseAtRaw.trim()) return true;

      // Teacher should always see scheduled/held posts.
      if (currentUserId && post.teacher_id === currentUserId) return true;

      const releaseMs = Date.parse(releaseAtRaw);
      if (!Number.isFinite(releaseMs)) return true;

      // Students only see it after release time.
      return nowMs >= releaseMs;
    });
  }, [posts, currentUserId, nowMs]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="edu-card rounded-2xl p-5 min-h-[180px] animate-pulse bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (visiblePosts.length === 0)
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-3">📝</span>
        <p className="text-muted-foreground text-sm">
          No posts yet. Teachers can create the first post!
        </p>
      </div>
    );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {visiblePosts.map((post) => {
        const cfg = typeConfig[post.type] || typeConfig.announcement;
        const gyanStudent = getGyanEngagementStudentViewModel(
          (post.content_json as unknown as import("@/integrations/supabase/types").Json) ?? null,
          post.type
        );
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
            </div>
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
                  (post.content_json as unknown as import("@/integrations/supabase/types").Json) ??
                    null,
                  post.type
                )
              );
              const linkTask = tasks.find((t) => t.href && t.visible_to_student);
              if (!linkTask) return null;
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
              const isSubmitted = submittedPostIds.has(post.id);
              return (
                <div className="mt-2 flex items-center gap-2">
                  {isSubmitted && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                  {isNewTab ? (
                    <a
                      href={trackedHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open link
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = trackedHref;
                      }}
                    >
                      Open link
                    </span>
                  )}
                </div>
              );
            })()}
            {post.due_date && (
              <p className="text-[10px] font-bold text-destructive flex items-center gap-0.5 mt-2">
                <Calendar className="w-3 h-3 shrink-0" /> Due{" "}
                {format(new Date(post.due_date), "MMM d")}
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

        const cardClass = `edu-card rounded-2xl p-5 transition-all flex flex-col hover:border-primary/30 hover:shadow-md ${
          gyanStudent ? "min-h-[220px]" : "min-h-[180px]"
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
      })}
    </div>
  );
};

export default ClassFeed;
