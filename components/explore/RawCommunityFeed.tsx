"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slugs";
import { useUserStore } from "@/store/useUserStore";
import { syncAllSavedContent } from "@/lib/savedContentService";
import RawFeedPostCard, { type CommentRow } from "./RawFeedPostCard";
import type { RawPostRow } from "./rawFeedTypes";
import type { SavedCommunityPost } from "@/types";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export type { RawPostRow } from "./rawFeedTypes";

const LATEST_PAGE_SIZE = 5;

export type RawFeedFilter = "all" | "physics" | "chemistry" | "math" | "biology";

const FILTER_CHIPS: { id: RawFeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "math", label: "Math" },
  { id: "biology", label: "Biology" },
];

/** Hint FK so PostgREST works when lessons_raw_posts has multiple references to profiles. */
const PROFILE_EMBED = "profiles!lessons_raw_posts_user_id_fkey(name, avatar_url)";
const COMMENT_PROFILE_EMBED = "profiles!lessons_raw_post_comments_user_id_fkey(name)";

/** When DB migrations are not yet applied on the project behind NEXT_PUBLIC_SUPABASE_URL. */
const SELECT_LESSONS_RAW_LEGACY =
  `id, user_id, kind, title, content, tags, subject, chapter_ref, board_ref, grade_ref, unit_ref, topic_ref, subtopic_ref, source_type, source_payload, boost_count, created_at, ${PROFILE_EMBED}`;
const SELECT_LESSONS_RAW_FULL =
  `id, user_id, kind, title, content, tags, subject, chapter_ref, board_ref, grade_ref, unit_ref, topic_ref, subtopic_ref, source_type, source_payload, boost_count, upvote_count, downvote_count, comment_count, created_at, ${PROFILE_EMBED}`;

function isMissingVoteCountColumns(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("upvote_count") || m.includes("downvote_count") || m.includes("comment_count");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export interface RawCommunityFeedProps {
  refreshKey?: number;
}

export default function RawCommunityFeed({ refreshKey = 0 }: RawCommunityFeedProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const saveCommunityPost = useUserStore((s) => s.saveCommunityPost);
  const savedCommunityPosts = useUserStore((s) => s.user?.savedCommunityPosts ?? []);
  const [filter, setFilter] = useState<RawFeedFilter>("all");
  const [posts, setPosts] = useState<RawPostRow[]>([]);
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myVotes, setMyVotes] = useState<Record<string, -1 | 0 | 1>>({});
  const [threadOpen, setThreadOpen] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [replyParentId, setReplyParentId] = useState<Record<string, string | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const runSelect = async (selectStr: string) => {
        let q = supabase
          .from("lessons_raw_posts")
          .select(selectStr)
          .order("created_at", { ascending: false })
          .limit(LATEST_PAGE_SIZE);
        if (filter !== "all") {
          q = q.eq("subject", filter);
        }
        return q;
      };

      let { data, error } = await runSelect(SELECT_LESSONS_RAW_FULL);

      if (error && isMissingVoteCountColumns(error.message)) {
        const second = await runSelect(SELECT_LESSONS_RAW_LEGACY);
        data = second.data;
        error = second.error;
        if (!error && data) {
          data = data.map((r) =>
            isObjectRecord(r)
              ? Object.assign({}, r, {
                  upvote_count: 0,
                  downvote_count: 0,
                  comment_count: 0,
                })
              : r
          );
        }
      }

      if (error) {
        toast({ title: "Feed unavailable", description: error.message, variant: "destructive" });
        setPosts([]);
        return;
      }
      const rows = ((data ?? []) as unknown) as RawPostRow[];
      setPosts(rows);

      const voteMap: Record<string, -1 | 0 | 1> = {};
      if (user?.id && rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: votes, error: voteErr } = await supabase
          .from("lessons_raw_post_votes")
          .select("post_id, vote")
          .eq("user_id", user.id)
          .in("post_id", ids);
        if (!voteErr && votes) {
          for (const v of votes) {
            const pid = (v as { post_id: string }).post_id;
            const vote = (v as { vote: number }).vote;
            voteMap[pid] = vote === 1 ? 1 : -1;
          }
        }
      }
      setMyVotes(voteMap);
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast, filter]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const focus = new URLSearchParams(window.location.search).get("focusPost");
    if (focus) setFocusPostId(focus);
  }, []);

  useEffect(() => {
    if (!focusPostId || loading || posts.length === 0) return;
    const hasPost = posts.some((p) => p.id === focusPostId);
    if (!hasPost) return;
    const id = `raw-post-${focusPostId}`;
    const run = () => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    const t = window.setTimeout(run, 120);
    return () => window.clearTimeout(t);
  }, [focusPostId, loading, posts]);

  const filtered = posts;

  const handleVote = async (postId: string, direction: 1 | -1) => {
    if (!user?.id) {
      toast({ title: "Sign in to vote", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.rpc("vote_lessons_raw_post", {
      p_post_id: postId,
      p_click: direction,
    });
    if (error) {
      toast({ title: "Vote failed", description: error.message, variant: "destructive" });
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const up = row?.up_count as number | undefined;
    const down = row?.down_count as number | undefined;
    const mv = row?.my_vote as number | undefined;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              upvote_count: up ?? p.upvote_count,
              downvote_count: down ?? p.downvote_count,
            }
          : p
      )
    );
    setMyVotes((prev) => ({ ...prev, [postId]: (mv === 1 ? 1 : mv === -1 ? -1 : 0) as -1 | 0 | 1 }));
  };

  const loadComments = async (postId: string) => {
    setCommentsLoading((m) => ({ ...m, [postId]: true }));
    const { data, error } = await supabase
      .from("lessons_raw_post_comments")
      .select(`id, post_id, user_id, parent_id, body, created_at, ${COMMENT_PROFILE_EMBED}`)
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(200);
    setCommentsLoading((m) => ({ ...m, [postId]: false }));
    if (error) {
      toast({ title: "Could not load thread", description: error.message, variant: "destructive" });
      return;
    }
    setCommentsByPost((m) => ({ ...m, [postId]: (data ?? []) as CommentRow[] }));
  };

  const submitComment = async (postId: string) => {
    if (!user?.id) {
      toast({ title: "Sign in to comment", variant: "destructive" });
      return;
    }
    const text = (commentDraft[postId] ?? "").trim();
    if (text.length < 1) {
      toast({ title: "Empty comment", variant: "destructive" });
      return;
    }
    const parent = replyParentId[postId] ?? null;
    const { data, error } = await supabase
      .from("lessons_raw_post_comments")
      .insert({
        post_id: postId,
        user_id: user.id,
        parent_id: parent,
        body: text,
      })
      .select(`id, post_id, user_id, parent_id, body, created_at, ${COMMENT_PROFILE_EMBED}`)
      .single();
    if (error) {
      toast({ title: "Comment failed", description: error.message, variant: "destructive" });
      return;
    }
    setCommentDraft((m) => ({ ...m, [postId]: "" }));
    setReplyParentId((m) => ({ ...m, [postId]: null }));
    const row = data as CommentRow;
    setCommentsByPost((m) => ({
      ...m,
      [postId]: [...(m[postId] ?? []), row],
    }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p))
    );
    toast({ title: "Posted" });
  };

  const savePostForRevision = (post: RawPostRow) => {
    if (!user?.id) {
      toast({ title: "Sign in to save", variant: "destructive" });
      return;
    }
    const alreadySaved = savedCommunityPosts.some((p) => p.postId === post.id);
    if (alreadySaved) {
      toast({ title: "Already saved", description: "This post is already in Community Posts." });
      return;
    }
    const savedPost: SavedCommunityPost = {
      id: `community-${post.id}`,
      postId: post.id,
      title: post.title?.trim() ?? "",
      content: post.content ?? "",
      subject: post.subject ?? null,
      chapterRef: post.chapter_ref ?? null,
      topicRef: post.topic_ref ?? null,
      subtopicRef: post.subtopic_ref ?? null,
      createdAt: post.created_at,
      savedAt: new Date().toISOString(),
    };
    saveCommunityPost(savedPost);
    syncAllSavedContent().catch(() => {});
    toast({
      title: "Saved to revision",
      description: (
        <div className="mt-0.5 space-y-2">
          <p className="text-xs leading-relaxed">Saved in: Revision &gt; Community Posts.</p>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-md px-3 text-xs font-semibold"
            onClick={() => router.push("/revision?tab=community")}
          >
            Go to Community Posts
          </Button>
        </div>
      ),
    });
  };

  const buildPostSourceLink = (post: RawPostRow): string | null => {
    const panel = post.source_type === "quiz_post" ? "quiz" : "instacue";
    const freshQuiz = post.source_type === "quiz_post" ? "&freshQuiz=1" : "";
    const subject = (post.subject ?? "").trim().toLowerCase();
    if (!subject || !["physics", "chemistry", "math", "biology"].includes(subject)) return null;
    const board = (post.board_ref ?? "").trim().toLowerCase() || "cbse";
    const grade = (post.grade_ref ?? "").trim() || "class-12";
    const unit = (post.unit_ref ?? "").trim();
    if (!unit) return null;

    const payloadLevel = typeof post.source_payload?.level === "string"
      ? post.source_payload.level.toLowerCase()
      : "";
    const level =
      payloadLevel === "basics" || payloadLevel === "intermediate" || payloadLevel === "advanced"
        ? payloadLevel
        : "advanced";

    const subtopicRaw = (post.subtopic_ref ?? "").trim();
    if (subtopicRaw.length > 0) {
      return `/${board}/${subject}/${grade}/${slugify(unit)}/${slugify(subtopicRaw)}/${level}?panel=${panel}${freshQuiz}`;
    }

    return `/${board}/${subject}/${grade}/${slugify(unit)}/overview/${level}?panel=${panel}${freshQuiz}`;
  };

  const openPostSourceLink = (post: RawPostRow) => {
    const href = buildPostSourceLink(post);
    if (!href) {
      toast({
        title: "Link unavailable",
        description: "This post does not have enough topic context to open a source link.",
      });
      return;
    }
    router.push(href);
  };

  return (
    <div id="raw-community-feed" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-bold text-foreground">Latest from your network</h3>
        <p className="text-xs text-muted-foreground">
          Human posts only — not Gyan++. <span className="text-foreground/70">Latest {LATEST_PAGE_SIZE}.</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTER_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold transition-colors",
              filter === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border p-4 dark:border-white/10">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground dark:border-white/15">
          No posts yet. Be the first to share something you learned.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card dark:divide-white/10 dark:border-white/10 dark:bg-slate-950/80">
          {filtered.map((post, i) => (
            <div
              key={post.id}
              id={`raw-post-${post.id}`}
              className={cn(
                "transition-colors",
                focusPostId === post.id && "bg-primary/5 ring-1 ring-primary/30"
              )}
            >
              <RawFeedPostCard
                post={{
                  ...post,
                  upvote_count: post.upvote_count ?? 0,
                  downvote_count: post.downvote_count ?? 0,
                  comment_count: post.comment_count ?? 0,
                }}
                index={i}
                isSavedForRevision={savedCommunityPosts.some((p) => p.postId === post.id)}
                myVote={myVotes[post.id] ?? 0}
                threadOpen={!!threadOpen[post.id]}
                comments={commentsByPost[post.id] ?? []}
                commentsLoading={!!commentsLoading[post.id]}
                commentDraft={commentDraft[post.id] ?? ""}
                replyParentId={replyParentId[post.id] ?? null}
                onVote={(dir) => void handleVote(post.id, dir)}
                onToggleThread={() =>
                  setThreadOpen((m) => ({
                    ...m,
                    [post.id]: !m[post.id],
                  }))
                }
                onLoadComments={() => void loadComments(post.id)}
                onCommentDraft={(v) => setCommentDraft((m) => ({ ...m, [post.id]: v }))}
                onSubmitComment={() => void submitComment(post.id)}
                onReplyTo={(cid) => setReplyParentId((m) => ({ ...m, [post.id]: cid }))}
                onSaveForRevision={() => savePostForRevision(post)}
                canOpenSourceLink={Boolean(buildPostSourceLink(post))}
                onOpenSourceLink={() => openPostSourceLink(post)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
