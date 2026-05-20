"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slugs";
import { useUserStore } from "@/store/useUserStore";
import { syncAllSavedContent } from "@/lib/saved/savedContentService";
import RawFeedPostCard, { type CommentRow } from "./RawFeedPostCard";
import type { RawPostRow } from "./rawFeedTypes";
import type { SavedCommunityPost } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export type { RawPostRow } from "./rawFeedTypes";

const PREVIEW_PAGE_SIZE = 5;

export const FULL_PAGE_SIZE_OPTIONS = [10, 20, 30, 40] as const;
export type CommunityFeedPageSize = (typeof FULL_PAGE_SIZE_OPTIONS)[number];

function coercePerPage(n: number | undefined): CommunityFeedPageSize {
  if (n === 10 || n === 20 || n === 30 || n === 40) return n;
  return 20;
}

export type RawFeedFilter = "all" | "physics" | "chemistry" | "math";

const FILTER_CHIPS: { id: RawFeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "math", label: "Math" },
];

const FILTER_SUMMARY: Record<RawFeedFilter, string> = {
  all: "All subjects",
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Mathematics",
};

/** Hint FK so PostgREST works when lessons_raw_posts has multiple references to profiles. */
const PROFILE_EMBED = "profiles!lessons_raw_posts_user_id_fkey(name, avatar_url)";
const COMMENT_PROFILE_EMBED = "profiles!lessons_raw_post_comments_user_id_fkey(name)";

/** When DB migrations are not yet applied on the project behind NEXT_PUBLIC_SUPABASE_URL. */
const SELECT_LESSONS_RAW_LEGACY = `id, user_id, kind, title, content, tags, subject, chapter_ref, board_ref, grade_ref, unit_ref, topic_ref, subtopic_ref, source_type, source_payload, boost_count, created_at, ${PROFILE_EMBED}`;
const SELECT_LESSONS_RAW_FULL = `id, user_id, kind, title, content, tags, subject, chapter_ref, board_ref, grade_ref, unit_ref, topic_ref, subtopic_ref, source_type, source_payload, boost_count, upvote_count, downvote_count, comment_count, created_at, ${PROFILE_EMBED}`;

function isMissingVoteCountColumns(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("upvote_count") || m.includes("downvote_count") || m.includes("comment_count");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeLegacyRows(data: unknown[] | null): RawPostRow[] {
  const rows = (data ?? []) as unknown as RawPostRow[];
  return rows.map((r) =>
    isObjectRecord(r)
      ? Object.assign({}, r, {
          upvote_count: 0,
          downvote_count: 0,
          comment_count: 0,
        })
      : r
  );
}

/** Compact page list with ellipses (e.g. 1 … 5 6 7 … 24). */
function buildPageList(current: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages < 1) return [];
  if (totalPages === 1) return [1];
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const s = new Set<number>();
  s.add(1);
  s.add(totalPages);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= totalPages) s.add(i);
  }
  const sorted = [...s].sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

export interface RawCommunityFeedProps {
  refreshKey?: number;
  mode?: "preview" | "full";
  /** When `mode` is `full`, seed filter from `/explore/community?filter=` (set by parent from URL). */
  initialFilter?: RawFeedFilter;
  /** Full mode: initial page from `?page=` */
  initialPage?: number;
  /** Full mode: posts per page from `?perPage=` */
  initialPerPage?: CommunityFeedPageSize;
  /** Full mode only: keep the address bar in sync (`?filter=&page=&perPage=`). Safe for `/explore/community` only. */
  syncPaginationUrl?: boolean;
}

export default function RawCommunityFeed({
  refreshKey = 0,
  mode = "preview",
  initialFilter,
  initialPage,
  initialPerPage,
  syncPaginationUrl = false,
}: RawCommunityFeedProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const saveCommunityPost = useUserStore((s) => s.saveCommunityPost);
  const savedCommunityPosts = useUserStore((s) => s.user?.savedCommunityPosts ?? []);
  const [filter, setFilter] = useState<RawFeedFilter>(() => {
    if (mode === "full" && initialFilter) return initialFilter;
    return "all";
  });
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, initialPage ?? 1));
  const [itemsPerPage, setItemsPerPage] = useState<CommunityFeedPageSize>(() =>
    coercePerPage(initialPerPage)
  );
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [posts, setPosts] = useState<RawPostRow[]>([]);
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myVotes, setMyVotes] = useState<Record<string, -1 | 0 | 1>>({});
  const [threadOpen, setThreadOpen] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [replyParentId, setReplyParentId] = useState<Record<string, string | null>>({});
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const focusFetchAttempted = useRef(false);
  const myVotesRef = useRef(myVotes);
  myVotesRef.current = myVotes;
  const skipPaginationScroll = useRef(true);

  const previewPageSize = PREVIEW_PAGE_SIZE;

  const mergeVotesForIds = useCallback(
    async (rows: RawPostRow[], prevVotes: Record<string, -1 | 0 | 1>) => {
      const voteMap: Record<string, -1 | 0 | 1> = { ...prevVotes };
      if (!user?.id || rows.length === 0) return voteMap;
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
      return voteMap;
    },
    [user?.id]
  );

  const fetchBatch = useCallback(
    async (from: number, to: number): Promise<RawPostRow[] | null> => {
      const runRange = async (selectStr: string) => {
        let q = supabase
          .from("lessons_raw_posts")
          .select(selectStr)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (filter !== "all") {
          q = q.eq("subject", filter);
        }
        return q;
      };

      const first = await runRange(SELECT_LESSONS_RAW_FULL);

      if (first.error && isMissingVoteCountColumns(first.error.message)) {
        const second = await runRange(SELECT_LESSONS_RAW_LEGACY);
        if (second.error) {
          toast({
            title: "Feed unavailable",
            description: second.error.message,
            variant: "destructive",
          });
          return null;
        }
        return normalizeLegacyRows((second.data ?? []) as unknown[]);
      }

      if (first.error) {
        toast({ title: "Feed unavailable", description: first.error.message, variant: "destructive" });
        return null;
      }
      return (first.data ?? []) as unknown as RawPostRow[];
    },
    [filter, toast]
  );

  const fetchTotalCount = useCallback(async (): Promise<number | null> => {
    let q = supabase.from("lessons_raw_posts").select("*", { count: "exact", head: true });
    if (filter !== "all") {
      q = q.eq("subject", filter);
    }
    const { count, error } = await q;
    if (error) {
      toast({ title: "Feed unavailable", description: error.message, variant: "destructive" });
      return null;
    }
    return count ?? 0;
  }, [filter, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    focusFetchAttempted.current = false;
    try {
      if (mode === "preview") {
        const to = previewPageSize - 1;
        const rows = await fetchBatch(0, to);
        if (rows === null) {
          setPosts([]);
          setTotalCount(null);
          return;
        }
        setPosts(rows);
        setTotalCount(null);
        const voteMap = await mergeVotesForIds(rows, {});
        setMyVotes(voteMap);
        return;
      }

      const count = await fetchTotalCount();
      if (count === null) {
        setPosts([]);
        setTotalCount(null);
        return;
      }
      setTotalCount(count);
      const totalPages = Math.max(1, Math.ceil(count / itemsPerPage));
      const page = Math.min(Math.max(1, currentPage), totalPages);
      if (page !== currentPage) {
        setCurrentPage(page);
      }
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const rows = await fetchBatch(from, to);
      if (rows === null) {
        setPosts([]);
        return;
      }
      setPosts(rows);
      const voteMap = await mergeVotesForIds(rows, {});
      setMyVotes(voteMap);
    } finally {
      setLoading(false);
    }
  }, [
    fetchBatch,
    fetchTotalCount,
    mergeVotesForIds,
    mode,
    previewPageSize,
    itemsPerPage,
    currentPage,
  ]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (mode !== "full" || !syncPaginationUrl) return;
    const params = new URLSearchParams();
    params.set("filter", filter);
    params.set("page", String(currentPage));
    params.set("perPage", String(itemsPerPage));
    const qs = params.toString();
    if (typeof window !== "undefined") {
      const cur = new URLSearchParams(window.location.search).toString();
      if (cur === qs) return;
    }
    router.replace(`/explore/community?${qs}`, { scroll: false });
  }, [mode, syncPaginationUrl, filter, currentPage, itemsPerPage, router]);

  useEffect(() => {
    if (mode !== "full" || !syncPaginationUrl) return;
    const syncFromLocation = () => {
      const sp = new URLSearchParams(window.location.search);
      const p = Math.max(1, Number(sp.get("page")) || 1);
      const ppRaw = Number(sp.get("perPage"));
      const pp = coercePerPage(Number.isFinite(ppRaw) ? ppRaw : undefined);
      const fr = sp.get("filter");
      const f: RawFeedFilter =
        fr === "all" || fr === "physics" || fr === "chemistry" || fr === "math" ? fr : "all";
      setCurrentPage(p);
      setItemsPerPage(pp);
      setFilter(f);
    };
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, [mode, syncPaginationUrl]);

  useEffect(() => {
    if (mode !== "full") return;
    if (skipPaginationScroll.current) {
      skipPaginationScroll.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mode, currentPage]);

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

  useEffect(() => {
    focusFetchAttempted.current = false;
  }, [focusPostId]);

  useEffect(() => {
    if (mode !== "full" || !focusPostId || loading) return;
    if (posts.some((p) => p.id === focusPostId)) return;
    if (focusFetchAttempted.current) return;
    focusFetchAttempted.current = true;

    let cancelled = false;
    void (async () => {
      const full = await supabase
        .from("lessons_raw_posts")
        .select(SELECT_LESSONS_RAW_FULL)
        .eq("id", focusPostId)
        .maybeSingle();

      let row: RawPostRow | null = null;
      if (!full.error && full.data) {
        row = full.data as unknown as RawPostRow;
      } else if (full.error && isMissingVoteCountColumns(full.error.message)) {
        const legacy = await supabase
          .from("lessons_raw_posts")
          .select(SELECT_LESSONS_RAW_LEGACY)
          .eq("id", focusPostId)
          .maybeSingle();
        if (legacy.error || !legacy.data) return;
        const d = legacy.data;
        row = (
          isObjectRecord(d)
            ? Object.assign({}, d, {
                upvote_count: 0,
                downvote_count: 0,
                comment_count: 0,
              })
            : d
        ) as RawPostRow;
      } else if (full.error) {
        return;
      }

      if (cancelled || !row) return;
      const focusRow = row;
      setPosts((prev) => {
        if (prev.some((p) => p.id === focusRow.id)) return prev;
        return [focusRow, ...prev];
      });
      const mergedVotes = await mergeVotesForIds([focusRow], myVotesRef.current);
      if (!cancelled) setMyVotes(mergedVotes);
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, focusPostId, loading, posts, mergeVotesForIds]);

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
    setMyVotes((prev) => ({
      ...prev,
      [postId]: (mv === 1 ? 1 : mv === -1 ? -1 : 0) as -1 | 0 | 1,
    }));
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
    if (!subject || !["physics", "chemistry", "math"].includes(subject)) return null;
    const board = (post.board_ref ?? "").trim().toLowerCase() || "cbse";
    const grade = (post.grade_ref ?? "").trim() || "class-12";
    const unit = (post.unit_ref ?? "").trim();
    if (!unit) return null;

    const payloadLevel =
      typeof post.source_payload?.level === "string" ? post.source_payload.level.toLowerCase() : "";
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

  const handleFilterChange = (id: RawFeedFilter) => {
    setFilter(id);
    if (mode === "full") {
      setCurrentPage(1);
      skipPaginationScroll.current = true;
    }
  };

  const handlePerPageChange = (n: CommunityFeedPageSize) => {
    setItemsPerPage(n);
    setCurrentPage(1);
    skipPaginationScroll.current = true;
  };

  const resetFilters = () => {
    setFilter("all");
    setItemsPerPage(20);
    setCurrentPage(1);
    skipPaginationScroll.current = true;
    setFilterPopoverOpen(false);
  };

  const applySubjectFromMenu = (id: RawFeedFilter) => {
    handleFilterChange(id);
    setFilterPopoverOpen(false);
  };

  const applyPerPageFromMenu = (n: CommunityFeedPageSize) => {
    handlePerPageChange(n);
    setFilterPopoverOpen(false);
  };

  const filtersActive = filter !== "all" || itemsPerPage !== 20;

  const totalPages =
    mode === "full" && totalCount !== null ? Math.max(1, Math.ceil(totalCount / itemsPerPage)) : 1;
  const pageList = mode === "full" ? buildPageList(currentPage, totalPages) : [];

  const viewAllHref = `/explore/community?filter=${filter}`;
  const compact = mode === "full";
  const skeletonCount = mode === "full" ? 8 : 5;

  return (
    <div
      id="raw-community-feed"
      className={cn("space-y-3", mode === "full" && "space-y-3 sm:space-y-4")}
    >
      {mode === "full" ? (
        <div className="flex flex-col gap-3 border-b border-border/80 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">Posts</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/90">{FILTER_SUMMARY[filter]}</span>
              <span className="mx-2 inline-block h-3 w-px translate-y-px bg-border align-middle" aria-hidden />
              <span className="tabular-nums">{itemsPerPage} rows per page</span>
              <span className="mx-2 inline-block h-3 w-px translate-y-px bg-border align-middle" aria-hidden />
              <span className="text-muted-foreground">Human posts only · not Gyan++</span>
            </p>
          </div>
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="relative h-9 shrink-0 gap-2 border-border bg-background px-3 text-sm font-medium shadow-sm ring-offset-background hover:bg-accent/50"
                aria-expanded={filterPopoverOpen}
                aria-haspopup="dialog"
              >
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
                Filters
                {filtersActive ? (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm ring-2 ring-background"
                    aria-label="Filters active"
                  >
                    {(filter !== "all" ? 1 : 0) + (itemsPerPage !== 20 ? 1 : 0)}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-[min(100vw-1.5rem,20rem)] border-border/80 p-0 shadow-lg sm:w-80"
            >
              <div className="border-b border-border/80 px-4 py-3 dark:border-white/10">
                <p className="text-sm font-semibold text-foreground">Filter posts</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Adjust subject scope and page density.</p>
              </div>
              <div className="px-3 py-3">
                <Label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Subject
                </Label>
                <div className="mt-2 space-y-0.5" role="listbox" aria-label="Subject filter">
                  {FILTER_CHIPS.map((c) => {
                    const selected = filter === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => applySubjectFromMenu(c.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          selected
                            ? "bg-primary/10 font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        <span>{c.label === "All" ? "All subjects" : c.label}</span>
                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                        ) : (
                          <span className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator className="bg-border/60" />
              <div className="px-3 py-3">
                <Label className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Rows per page
                </Label>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {FULL_PAGE_SIZE_OPTIONS.map((n) => {
                    const selected = itemsPerPage === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => applyPerPageFromMenu(n)}
                        className={cn(
                          "rounded-lg border py-2 text-center text-sm font-medium tabular-nums transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-foreground shadow-sm"
                            : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-white/5"
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/80 bg-muted/30 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={resetFilters}
                  disabled={!filtersActive}
                >
                  Reset to defaults
                </Button>
                <Button type="button" size="sm" className="h-8 px-4 text-xs font-semibold" onClick={() => setFilterPopoverOpen(false)}>
                  Done
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <h3 className="text-sm font-bold text-foreground sm:text-base">Latest from your network</h3>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              Human posts only — not Gyan++.{" "}
              <span className="text-foreground/70">Latest {PREVIEW_PAGE_SIZE}.</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleFilterChange(c.id)}
                className={cn(
                  "min-h-10 rounded-full px-3 py-1.5 text-xs font-bold transition-colors sm:min-h-0 sm:py-1",
                  filter === c.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted dark:bg-slate-800 dark:text-slate-300"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-border p-4 dark:border-white/10"
            >
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
        <>
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
                  compact={compact}
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

          {mode === "full" && totalCount !== null && totalCount > 0 ? (
            <nav
              className="flex flex-col gap-3 border-t border-border/70 pt-4 dark:border-white/10"
              aria-label="Pagination"
            >
              <p className="text-center text-[11px] text-muted-foreground sm:text-left sm:text-xs">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {(currentPage - 1) * itemsPerPage + 1}–
                  {Math.min(currentPage * itemsPerPage, totalCount)}
                </span>{" "}
                of <span className="font-medium text-foreground">{totalCount}</span> posts
              </p>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between gap-2 sm:flex-wrap sm:justify-start sm:gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 px-2.5 text-xs font-semibold"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <ul className="hidden flex-wrap items-center justify-center gap-1 px-1 sm:flex">
                    {pageList.map((item, idx) =>
                      item === "ellipsis" ? (
                        <li key={`e-${idx}`}>
                          <span
                            className="flex h-9 min-w-9 items-center justify-center text-muted-foreground"
                            aria-hidden
                          >
                            …
                          </span>
                        </li>
                      ) : (
                        <li key={item}>
                          <Button
                            type="button"
                            variant={item === currentPage ? "default" : "outline"}
                            size="sm"
                            className="h-9 min-w-9 px-0 text-xs font-semibold tabular-nums"
                            onClick={() => setCurrentPage(item)}
                            aria-label={`Page ${item}`}
                            aria-current={item === currentPage ? "page" : undefined}
                          >
                            {item}
                          </Button>
                        </li>
                      )
                    )}
                  </ul>
                  <span className="text-xs font-medium text-muted-foreground sm:hidden">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1 px-2.5 text-xs font-semibold"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </Button>
                </div>
              </div>
            </nav>
          ) : null}

          {mode === "preview" && filtered.length > 0 ? (
            <div className="flex justify-end pt-1">
              <Link
                href={viewAllHref}
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                View all
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
