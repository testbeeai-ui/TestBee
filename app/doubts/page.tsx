"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

import {
  DOUBT_FLAIRS,
  type ExpandedDoubtRow,
  type ProfileRow,
  type SortOption,
  type ActivityView,
  type TabFilter,
  doubtHasAiTutorAnswer,
} from "@/components/doubts/doubtTypes";
import { canonicalDoubtSubject } from "@/lib/doubtSubject";

import AskDoubtDialog from "@/components/doubts/AskDoubtDialog";
import GyanBotAdminPanel from "@/components/doubts/GyanBotAdminPanel";
import LiveQAHeader from "@/components/doubts/LiveQAHeader";
import DoubtsTabBar from "@/components/doubts/DoubtsTabBar";
import DoubtFeedCard from "@/components/doubts/DoubtFeedCard";
import DoubtLeftSidebar from "@/components/doubts/DoubtLeftSidebar";
import DoubtRightSidebar from "@/components/doubts/DoubtRightSidebar";
import { GyanDoubtsFocusTracker } from "@/components/doubts/GyanDoubtsFocusTracker";
import {
  GyanDailyChecklistTracker,
  GyanDailyChecklistSidebarCard,
} from "@/components/doubts/GyanDailyChecklistTracker";
import GyanFeedPagination, { GYAN_FEED_PAGE_SIZE } from "@/components/doubts/GyanFeedPagination";
import { gyanWallFontClass, gyanWallGridClass } from "@/components/doubts/gyanWallStyles";
import { dispatchStudyDayBumped } from "@/lib/dashboard/studyDayBumpEvents";
import { DEFAULT_RDM_CONFIG, fetchRdmConfig } from "@/lib/rdm/rdmConfig";
import { OnboardingGuidanceBanner } from "@/components/onboarding/OnboardingGuidanceBanner";
import {
  clearGyanPlusOnboardingQueryParams,
  gyanDoubtsPathFromSearchParams,
  isGyanPlusCompanionFlowComplete,
  isGyanPlusOnboardingComplete,
  isGyanPlusOnboardingSessionActive,
  isGyanPlusSubstepDone,
  recordGyanPlusSubstep,
} from "@/lib/onboarding/gyanPlusOnboarding";
import {
  parseGyanAssignmentContext,
  type GyanAssignmentContext,
} from "@/lib/classroom/gyanAssignmentCompletion";
import { dispatchClassroomAssignmentProgressChanged } from "@/lib/classroom/assignmentProgressSync";
import { isDailyChecklistCompanionRetryActive } from "@/lib/onboarding/dailyChecklistCompanionRetry";
import {
  isGyanPlusCompanionTrackingActive,
  markGyanPlusCompanionComment,
  markGyanPlusCompanionPost,
  markGyanPlusCompanionUpvote,
  reconcileGyanPlusCompanionSteps,
  startGyanPlusBrowseCountdown,
  tickGyanPlusBrowseCountdown,
} from "@/lib/onboarding/gyanPlusCompanionOnboarding";
import {
  getOnboardingProgress,
  ONBOARDING_PROGRESS_EVENT,
} from "@/lib/subscription/freeTrialClient";

type SimpleDoubtRow = {
  id: string;
  title: string;
  bounty_rdm?: number;
  views?: number;
  subject?: string | null;
};

function DoubtsPageContent() {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedAskFromQuery = useRef(false);

  // Core data
  const [doubts, setDoubts] = useState<ExpandedDoubtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [strikeRate, setStrikeRate] = useState<{ accepted: number; total: number } | null>(null);
  const [savedDoubtIds, setSavedDoubtIds] = useState<Set<string>>(new Set());
  const [answeredDoubtIds, setAnsweredDoubtIds] = useState<Set<string>>(new Set());
  // key: doubt_id, value: 1 | -1
  const [myVotes, setMyVotes] = useState<Map<string, number>>(new Map());

  // Sidebar data
  const [trending, setTrending] = useState<SimpleDoubtRow[]>([]);
  const [topContributors, setTopContributors] = useState<
    {
      user_id: string;
      total: number;
      profiles: { name: string; avatar_url: string | null } | null;
    }[]
  >([]);
  const [teacherWeeklyRdm, setTeacherWeeklyRdm] = useState<Map<string, number>>(new Map());

  // UI state
  const [askOpen, setAskOpen] = useState(false);

  const assignmentContextFromUrl = useMemo(
    () =>
      parseGyanAssignmentContext({
        classroomId: searchParams.get("classroomId"),
        postId: searchParams.get("postId"),
        taskId: searchParams.get("taskId"),
      }),
    [searchParams]
  );
  const [assignmentContext, setAssignmentContext] = useState<GyanAssignmentContext | null>(null);

  useEffect(() => {
    if (assignmentContextFromUrl) {
      setAssignmentContext(assignmentContextFromUrl);
    }
  }, [assignmentContextFromUrl]);

  const gyanOnboardingActive = isGyanPlusOnboardingSessionActive(searchParams);

  const [showGyanPostGuide, setShowGyanPostGuide] = useState(false);
  const [showGyanEngageGuide, setShowGyanEngageGuide] = useState(false);

  const syncGyanOnboardingGuides = useCallback(() => {
    if (!gyanOnboardingActive) {
      setShowGyanPostGuide(false);
      setShowGyanEngageGuide(false);
      return;
    }
    const progress = getOnboardingProgress();
    const flowDone =
      isGyanPlusCompanionTrackingActive() || isDailyChecklistCompanionRetryActive("gyan_plus")
        ? isGyanPlusCompanionFlowComplete(progress)
        : isGyanPlusOnboardingComplete(progress);
    if (flowDone) {
      setShowGyanPostGuide(false);
      setShowGyanEngageGuide(false);
      return;
    }
    setShowGyanPostGuide(
      isGyanPlusSubstepDone("gyan_browse") && !isGyanPlusSubstepDone("gyan_post")
    );
    setShowGyanEngageGuide(
      isGyanPlusSubstepDone("gyan_post") && !isGyanPlusSubstepDone("gyan_engagement")
    );
  }, [gyanOnboardingActive]);

  useEffect(() => {
    if (!gyanOnboardingActive) {
      syncGyanOnboardingGuides();
      return;
    }
    const progress = getOnboardingProgress();
    const companionSession =
      isGyanPlusCompanionTrackingActive() || isDailyChecklistCompanionRetryActive("gyan_plus");
    const flowDone = companionSession
      ? isGyanPlusCompanionFlowComplete(progress)
      : isGyanPlusOnboardingComplete(progress);

    if (flowDone && !companionSession) {
      const next = clearGyanPlusOnboardingQueryParams(new URLSearchParams(searchParams.toString()));
      const target = gyanDoubtsPathFromSearchParams(next);
      const current = gyanDoubtsPathFromSearchParams(new URLSearchParams(searchParams.toString()));
      if (target !== current) {
        router.replace(target, { scroll: false });
      }
      return;
    }
    reconcileGyanPlusCompanionSteps();
    syncGyanOnboardingGuides();
  }, [gyanOnboardingActive, searchParams, router, syncGyanOnboardingGuides]);

  /** Step 0: browse doubt wall ~1 min — visible countdown in task companion. */
  useEffect(() => {
    if (!gyanOnboardingActive || !isGyanPlusCompanionTrackingActive()) return;
    reconcileGyanPlusCompanionSteps();
    startGyanPlusBrowseCountdown();
    const intervalId = window.setInterval(() => {
      const justFinished = tickGyanPlusBrowseCountdown();
      if (justFinished) {
        if (!isGyanPlusSubstepDone("gyan_browse")) {
          recordGyanPlusSubstep("gyan_browse", { showChecklistToast: false });
        }
        syncGyanOnboardingGuides();
      }
    }, 1000);
    tickGyanPlusBrowseCountdown();
    return () => window.clearInterval(intervalId);
  }, [gyanOnboardingActive, syncGyanOnboardingGuides]);

  useEffect(() => {
    const onProgress = () => syncGyanOnboardingGuides();
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
  }, [syncGyanOnboardingGuides]);

  const handleAskClick = useCallback(() => {
    setAskOpen(true);
    if (showGyanPostGuide) {
      setShowGyanPostGuide(false);
    }
  }, [showGyanPostGuide]);

  useEffect(() => {
    if (openedAskFromQuery.current) return;
    if (searchParams.get("ask") !== "1") return;
    openedAskFromQuery.current = true;
    handleAskClick();
    const next = new URLSearchParams(searchParams.toString());
    next.delete("ask");
    const target = gyanDoubtsPathFromSearchParams(next);
    const current = gyanDoubtsPathFromSearchParams(new URLSearchParams(searchParams.toString()));
    if (target !== current) {
      router.replace(target, { scroll: false });
    }
  }, [router, searchParams, handleAskClick]);
  const [sort, setSort] = useState<SortOption>("recent");
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [activityView, setActivityView] = useState<ActivityView>("feed");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [userRdmToday, setUserRdmToday] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [gyanRdm, setGyanRdm] = useState({
    post: DEFAULT_RDM_CONFIG.gyan_post_rdm,
    comment: DEFAULT_RDM_CONFIG.gyan_comment_rdm,
    upvote: DEFAULT_RDM_CONFIG.gyan_upvote_rdm,
    save: DEFAULT_RDM_CONFIG.gyan_save_rdm,
    teacher: DEFAULT_RDM_CONFIG.gyan_teacher_answer_rdm,
  });
  /** Doubt ids we just posted; show Prof-Pi story strip until an AI answer exists or timeout */
  const [profPiPendingByDoubtId, setProfPiPendingByDoubtId] = useState<Record<string, number>>({});
  /** Paginated feed (10 per page) — client-side slice of filteredAndSorted */
  const [feedPage, setFeedPage] = useState(1);
  const feedTopRef = useRef<HTMLDivElement>(null);

  // ─── Data fetching ───────────────────────────────────────────

  const fetchDoubts = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const { data, error } = await supabase
          .from("doubts")
          .select(
            "*, doubt_answers(id, body, upvotes, downvotes, is_accepted, created_at, user_id, profiles!doubt_answers_user_id_fkey(name, avatar_url, role)), profiles!doubts_user_id_fkey(name, avatar_url, role), gyan_curriculum_nodes(chapter_label, topic_label, subtopic_label)"
          )
          .order("created_at", { ascending: false });
        if (error) {
          if (!opts?.silent) {
            const isNetworkError =
              error.message?.includes("fetch") || error.message?.includes("Failed to fetch");
            toast({
              title: "Could not load Gyan++",
              description: isNetworkError
                ? "Network error. Check your connection and that the Supabase project is not paused."
                : error.message,
              variant: "destructive",
            });
          }
          setDoubts([]);
        } else {
          setDoubts((data as ExpandedDoubtRow[]) || []);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network or connection error.";
        if (!opts?.silent) {
          toast({
            title: "Could not load Gyan++",
            description: msg.includes("fetch")
              ? "Network error. Check your connection and that the Supabase project is not paused."
              : msg,
            variant: "destructive",
          });
        }
        setDoubts([]);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [toast]
  );

  const handleCommentSuccess = useCallback(() => {
    void fetchDoubts();
    if (gyanOnboardingActive) {
      markGyanPlusCompanionComment();
      if (!isGyanPlusSubstepDone("gyan_engagement")) {
        recordGyanPlusSubstep("gyan_engagement", {
          toastActionLine: "You commented on a doubt!",
        });
      }
      syncGyanOnboardingGuides();
    }
  }, [fetchDoubts, gyanOnboardingActive, syncGyanOnboardingGuides]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, rdm, lifetime_answer_rdm, role")
      .eq("id", user.id)
      .maybeSingle();
    setProfile((data as ProfileRow) || null);
  };

  const fetchStrikeRate = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("doubt_answers")
      .select("id, is_accepted")
      .eq("user_id", user.id);
    const list = (data || []) as { id: string; is_accepted: boolean }[];
    setStrikeRate({ accepted: list.filter((a) => a.is_accepted).length, total: list.length });
  };

  const fetchSaved = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("doubt_saves").select("doubt_id").eq("user_id", user.id);
    setSavedDoubtIds(new Set((data || []).map((r: { doubt_id: string }) => r.doubt_id)));
  };

  const fetchAnsweredDoubtIds = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("doubt_answers").select("doubt_id").eq("user_id", user.id);
    setAnsweredDoubtIds(new Set((data || []).map((r: { doubt_id: string }) => r.doubt_id)));
  };

  const fetchMyVotes = useCallback(
    async (feedDoubts: ExpandedDoubtRow[]) => {
      if (!user?.id) return;
      const map = new Map<string, number>();

      const doubtIds = feedDoubts.map((d) => d.id);
      if (doubtIds.length > 0) {
        const { data: doubtVoteRows } = await supabase
          .from("doubt_votes")
          .select("target_id, vote_type")
          .eq("user_id", user.id)
          .eq("target_type", "doubt")
          .in("target_id", doubtIds);
        (doubtVoteRows || []).forEach((r: { target_id: string; vote_type: number }) =>
          map.set(`doubt:${r.target_id}`, r.vote_type)
        );
      }

      const answerIds = feedDoubts.flatMap((d) => (d.doubt_answers ?? []).map((a) => a.id));
      if (answerIds.length > 0) {
        const { data: answerVoteRows } = await supabase
          .from("doubt_votes")
          .select("target_id, vote_type")
          .eq("user_id", user.id)
          .eq("target_type", "answer")
          .in("target_id", answerIds);
        (answerVoteRows || []).forEach((r: { target_id: string; vote_type: number }) =>
          map.set(`answer:${r.target_id}`, r.vote_type)
        );
      }

      setMyVotes(map);
    },
    [user?.id]
  );

  const fetchTrending = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data } = await supabase
      .from("doubts")
      .select("id, title, views, subject")
      .gte("created_at", since.toISOString())
      .order("views", { ascending: false })
      .order("upvotes", { ascending: false })
      .limit(5);
    setTrending((data as SimpleDoubtRow[]) || []);
  };

  function getWeekStart(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }

  const fetchTopContributors = async () => {
    const { data } = await supabase
      .from("accepted_answer_payouts")
      .select("user_id, rdm_paid, paid_at")
      .gte("paid_at", getWeekStart());
    const list = (data || []) as { user_id: string; rdm_paid: number }[];
    const byUser = new Map<string, number>();
    list.forEach((r) => byUser.set(r.user_id, (byUser.get(r.user_id) || 0) + r.rdm_paid));
    setTeacherWeeklyRdm(new Map(byUser));
    const sorted = Array.from(byUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (sorted.length === 0) {
      setTopContributors([]);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in(
        "id",
        sorted.map((s) => s[0])
      );
    const byId = new Map(
      (profiles || []).map((p: { id: string; name: string; avatar_url: string | null }) => [
        p.id,
        p,
      ])
    );
    setTopContributors(
      sorted.map(([uid, total]) => ({
        user_id: uid,
        total,
        profiles: byId.get(uid)
          ? {
              name: (byId.get(uid) as { name: string }).name,
              avatar_url: (byId.get(uid) as { avatar_url: string | null }).avatar_url,
            }
          : null,
      }))
    );
  };

  const fetchUserRdmToday = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.rpc("get_daily_rdm_earned_ist");
    if (error) {
      console.warn("[doubts] get_daily_rdm_earned_ist", error.message);
      setUserRdmToday(0);
      return;
    }
    setUserRdmToday(typeof data === "number" ? data : Number(data ?? 0));
  };

  // ─── Effects ─────────────────────────────────────────────────

  useEffect(() => {
    void fetchDoubts();
  }, [fetchDoubts]);

  useEffect(() => {
    setProfPiPendingByDoubtId((p) => {
      const next = { ...p };
      let changed = false;
      for (const id of Object.keys(next)) {
        const row = doubts.find((d) => d.id === id);
        if (row && doubtHasAiTutorAnswer(row)) {
          delete next[id];
          changed = true;
        } else if (Date.now() - next[id] > 120_000) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : p;
    });
  }, [doubts]);

  const profPiPendingKey = Object.keys(profPiPendingByDoubtId).sort().join("|");

  /** Background refresh so new answers (Prof-Pi, teachers, comments) appear without manual reload */
  useEffect(() => {
    const intervalMs = profPiPendingKey ? 2800 : 20_000;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchDoubts({ silent: true });
    };
    const t = window.setInterval(tick, intervalMs);
    return () => clearInterval(t);
  }, [profPiPendingKey, fetchDoubts]);

  useEffect(() => {
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void fetchDoubts({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchDoubts]);

  useEffect(() => {
    fetchProfile();
    fetchStrikeRate();
    fetchSaved();
    fetchAnsweredDoubtIds();
    fetchUserRdmToday();
  }, [user?.id]);

  useEffect(() => {
    void fetchRdmConfig().then((cfg) => {
      setGyanRdm({
        post: cfg.gyan_post_rdm,
        comment: cfg.gyan_comment_rdm,
        upvote: cfg.gyan_upvote_rdm,
        save: cfg.gyan_save_rdm,
        teacher: cfg.gyan_teacher_answer_rdm,
      });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  useEffect(() => {
    fetchTrending();
    fetchTopContributors();
  }, []);

  // ─── Computed data ───────────────────────────────────────────

  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DOUBT_FLAIRS.forEach((f) => {
      counts[f] = 0;
    });
    doubts.forEach((d) => {
      const s = canonicalDoubtSubject(d.subject);
      if (s) counts[s]++;
    });
    return counts;
  }, [doubts]);

  const filteredAndSorted = useMemo(() => {
    let list = [...doubts];

    // Activity view
    if (activityView === "asked" && user?.id) list = list.filter((d) => d.user_id === user.id);
    else if (activityView === "saved") list = list.filter((d) => savedDoubtIds.has(d.id));
    else if (activityView === "answered") list = list.filter((d) => answeredDoubtIds.has(d.id));

    // Tab filter
    if (activeTab === "student") list = list.filter((d) => d.profiles?.role !== "teacher");
    else if (activeTab === "teacher")
      list = list.filter((d) =>
        (d.doubt_answers ?? []).some((a) => a.profiles?.role === "teacher")
      );
    else if (activeTab === "revision") list = list.filter((d) => savedDoubtIds.has(d.id));
    else if (activeTab === "ai") {
      list = list.filter(
        (d) =>
          d.profiles?.role === "ai" ||
          (d.doubt_answers ?? []).some((a) => a.profiles?.role === "ai")
      );
    }

    // Subject filter (canonical strings so "physics" / "Maths" still match chips)
    if (subjectFilters.length > 0) {
      list = list.filter((d) => {
        const s = canonicalDoubtSubject(d.subject);
        return Boolean(s && subjectFilters.includes(s));
      });
    }
    if (unansweredOnly) list = list.filter((d) => !(d.doubt_answers?.length ?? 0));

    // Sort
    if (sort === "recent")
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sort === "upvoted")
      list.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes));
    else if (sort === "unanswered")
      list.sort((a, b) => (a.doubt_answers?.length ?? 0) - (b.doubt_answers?.length ?? 0));
    else if (sort === "bounty") list.sort((a, b) => (b.bounty_rdm ?? 0) - (a.bounty_rdm ?? 0));
    else if (sort === "teacher_tagged")
      list.sort((a, b) => {
        const aH = (a.doubt_answers ?? []).some((ans) => ans.profiles?.role === "teacher") ? 1 : 0;
        const bH = (b.doubt_answers ?? []).some((ans) => ans.profiles?.role === "teacher") ? 1 : 0;
        return bH - aH;
      });
    else if (sort === "saved")
      list.sort((a, b) => {
        return (savedDoubtIds.has(b.id) ? 1 : 0) - (savedDoubtIds.has(a.id) ? 1 : 0);
      });

    return list;
  }, [
    doubts,
    sort,
    subjectFilters,
    unansweredOnly,
    activityView,
    activeTab,
    user?.id,
    savedDoubtIds,
    answeredDoubtIds,
  ]);

  const feedTotalPages = Math.max(1, Math.ceil(filteredAndSorted.length / GYAN_FEED_PAGE_SIZE));

  const paginatedFeed = useMemo(() => {
    const start = (feedPage - 1) * GYAN_FEED_PAGE_SIZE;
    return filteredAndSorted.slice(start, start + GYAN_FEED_PAGE_SIZE);
  }, [filteredAndSorted, feedPage]);

  useEffect(() => {
    void fetchMyVotes(paginatedFeed);
  }, [fetchMyVotes, paginatedFeed]);

  /** Reset to page 1 when filters / sort change so users don’t land on empty pages */
  useEffect(() => {
    setFeedPage(1);
  }, [activeTab, activityView, unansweredOnly, sort, subjectFilters, user?.id]);

  /** Clamp current page if the filtered list shrinks */
  useEffect(() => {
    setFeedPage((p) => Math.min(p, feedTotalPages));
  }, [feedTotalPages]);

  const handleFeedPageChange = useCallback((next: number) => {
    setFeedPage(next);
    queueMicrotask(() => {
      feedTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const askedCount = useMemo(
    () => (user?.id ? doubts.filter((d) => d.user_id === user.id).length : 0),
    [doubts, user?.id]
  );
  const answeredCount = answeredDoubtIds.size;
  const savedCount = savedDoubtIds.size;

  const todayCount = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return doubts.filter((d) => new Date(d.created_at) >= todayStart).length;
  }, [doubts]);

  const teacherTaggedCount = useMemo(() => {
    return doubts.filter((d) => (d.doubt_answers ?? []).some((a) => a.profiles?.role === "teacher"))
      .length;
  }, [doubts]);

  const aiAuthoredDoubtCount = useMemo(
    () => doubts.filter((d) => d.profiles?.role === "ai").length,
    [doubts]
  );

  // Compute top teachers from answers data
  const topTeachers = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        avatar_url: string | null;
        answerCount: number;
        rdmEarned: number;
        subject: string | null;
      }
    >();
    doubts.forEach((d) => {
      (d.doubt_answers ?? []).forEach((a) => {
        if (a.profiles?.role === "teacher") {
          const existing = map.get(a.user_id) ?? {
            name: a.profiles.name ?? "Teacher",
            avatar_url: a.profiles.avatar_url ?? null,
            answerCount: 0,
            rdmEarned: 0,
            subject: d.subject ?? null,
          };
          map.set(a.user_id, {
            ...existing,
            answerCount: existing.answerCount + 1,
            rdmEarned: teacherWeeklyRdm.get(a.user_id) ?? 0,
          });
        }
      });
    });
    return Array.from(map.entries())
      .map(([uid, data]) => ({ user_id: uid, ...data }))
      .sort((a, b) => b.rdmEarned - a.rdmEarned)
      .slice(0, 3);
  }, [doubts, teacherWeeklyRdm]);

  // ─── Handlers ────────────────────────────────────────────────

  const handleVote = async (
    targetType: "doubt" | "answer",
    targetId: string,
    direction: 1 | -1
  ) => {
    if (!user?.id) return;
    const voteKey = `${targetType}:${targetId}`;
    const current = myVotes.get(voteKey) ?? 0;

    const willLike = current !== direction && direction === 1;
    if (gyanOnboardingActive && targetType === "doubt" && willLike) {
      markGyanPlusCompanionUpvote();
      if (!isGyanPlusSubstepDone("gyan_engagement")) {
        recordGyanPlusSubstep("gyan_engagement", {
          toastActionLine: "You upvoted a doubt!",
        });
      }
      syncGyanOnboardingGuides();
    }

    const applyVoteDelta = (up: number, down: number) => {
      let nextUp = up;
      let nextDown = down;
      if (current === 1) nextUp--;
      else if (current === -1) nextDown--;
      if (current !== direction) {
        if (direction === 1) nextUp++;
        else nextDown++;
      }
      return { upvotes: nextUp, downvotes: nextDown };
    };

    let snapshotUp = 0;
    let snapshotDown = 0;
    for (const d of doubts) {
      if (targetType === "doubt" && d.id === targetId) {
        snapshotUp = d.upvotes;
        snapshotDown = d.downvotes;
        break;
      }
      if (targetType === "answer") {
        const a = (d.doubt_answers ?? []).find((x) => x.id === targetId);
        if (a) {
          snapshotUp = a.upvotes;
          snapshotDown = a.downvotes;
          break;
        }
      }
    }

    setDoubts((prev) =>
      prev.map((d) => {
        if (targetType === "doubt") {
          if (d.id !== targetId) return d;
          return { ...d, ...applyVoteDelta(d.upvotes, d.downvotes) };
        }
        const answers = d.doubt_answers ?? [];
        if (!answers.some((a) => a.id === targetId)) return d;
        return {
          ...d,
          doubt_answers: answers.map((a) =>
            a.id === targetId ? { ...a, ...applyVoteDelta(a.upvotes, a.downvotes) } : a
          ),
        };
      })
    );
    const optimisticUserVote = current === direction ? 0 : direction;
    setMyVotes((prev) => {
      const next = new Map(prev);
      if (optimisticUserVote === 0) next.delete(voteKey);
      else next.set(voteKey, optimisticUserVote);
      return next;
    });

    const { data, error } = await supabase.rpc("vote_on_doubt", {
      p_target_type: targetType,
      p_target_id: targetId,
      p_vote_type: direction,
    });
    if (error || !(data as { ok?: boolean })?.ok) {
      setMyVotes((prev) => {
        const next = new Map(prev);
        if (current === 0) next.delete(voteKey);
        else next.set(voteKey, current);
        return next;
      });
      setDoubts((prev) =>
        prev.map((d) => {
          if (targetType === "doubt" && d.id === targetId) {
            return { ...d, upvotes: snapshotUp, downvotes: snapshotDown };
          }
          if (targetType === "answer") {
            const answers = d.doubt_answers ?? [];
            if (!answers.some((a) => a.id === targetId)) return d;
            return {
              ...d,
              doubt_answers: answers.map((a) =>
                a.id === targetId
                  ? { ...a, upvotes: snapshotUp, downvotes: snapshotDown }
                  : a
              ),
            };
          }
          return d;
        })
      );
      return;
    }

    if ((data as { ok?: boolean })?.ok) {
      const res = data as {
        ok: boolean;
        upvotes?: number;
        downvotes?: number;
        user_vote?: number;
        voter_daily_rdm?: { awarded?: boolean; amount?: number };
      };
      if (typeof res.user_vote === "number") {
        setMyVotes((prev) => {
          const next = new Map(prev);
          if (res.user_vote === 0) next.delete(voteKey);
          else next.set(voteKey, res.user_vote as 1 | -1);
          return next;
        });
      }
      if (res.upvotes !== undefined && res.downvotes !== undefined) {
        setDoubts((prev) =>
          prev.map((d) => {
            if (targetType === "doubt" && d.id === targetId) {
              return { ...d, upvotes: res.upvotes!, downvotes: res.downvotes! };
            }
            if (targetType === "answer") {
              const answers = d.doubt_answers ?? [];
              if (!answers.some((a) => a.id === targetId)) return d;
              return {
                ...d,
                doubt_answers: answers.map((a) =>
                  a.id === targetId
                    ? { ...a, upvotes: res.upvotes!, downvotes: res.downvotes! }
                    : a
                ),
              };
            }
            return d;
          })
        );
      }
      if (res.voter_daily_rdm?.awarded && res.voter_daily_rdm.amount) {
        toast({
          title: `+${res.voter_daily_rdm.amount} RDM`,
          description: "First upvote milestone today (IST).",
        });
        void refreshProfile();
      }
      dispatchStudyDayBumped({ day: "", deltaMs: 0 });
    }
  };

  const toggleSubject = (flair: string) => {
    setSubjectFilters((prev) =>
      prev.includes(flair) ? prev.filter((s) => s !== flair) : [...prev, flair]
    );
  };

  const toggleSave = async (doubtId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id) return;
    const saved = savedDoubtIds.has(doubtId);
    if (saved) {
      await supabase.from("doubt_saves").delete().eq("user_id", user.id).eq("doubt_id", doubtId);
      setSavedDoubtIds((prev) => {
        const next = new Set(prev);
        next.delete(doubtId);
        return next;
      });
      toast({ title: "Removed from saved" });
      dispatchStudyDayBumped({ day: "", deltaMs: 0 });
    } else {
      const { data: beforeBal } = await supabase
        .from("profiles")
        .select("rdm")
        .eq("id", user.id)
        .maybeSingle();
      const beforeRdm = (beforeBal as { rdm?: number } | null)?.rdm ?? 0;
      const { error: insErr } = await supabase
        .from("doubt_saves")
        .insert({ user_id: user.id, doubt_id: doubtId });
      if (insErr) {
        toast({ title: "Could not save", description: insErr.message, variant: "destructive" });
        return;
      }
      setSavedDoubtIds((prev) => new Set(prev).add(doubtId));
      const { data: afterBal } = await supabase
        .from("profiles")
        .select("rdm")
        .eq("id", user.id)
        .maybeSingle();
      const afterRdm = (afterBal as { rdm?: number } | null)?.rdm ?? beforeRdm;
      const gained = afterRdm - beforeRdm;
      toast({
        title: "Saved for revision",
        description:
          gained >= gyanRdm.save
            ? `+${gyanRdm.save} RDM — first save milestone today (IST).`
            : undefined,
      });
      void refreshProfile();
      void fetchUserRdmToday();
      dispatchStudyDayBumped({ day: "", deltaMs: 0 });
    }
  };

  const handleDoubtPosted = (payload: {
    doubtId?: string | null;
    assignmentCompleted?: boolean;
    assignmentContext?: GyanAssignmentContext | null;
  }) => {
    const doubtId = payload.doubtId;
    if (doubtId) {
      setProfPiPendingByDoubtId((p) => ({ ...p, [doubtId]: Date.now() }));
    }
    void fetchDoubts();
    void fetchProfile();
    void refreshProfile();
    void fetchTrending();
    void fetchTopContributors();
    void fetchUserRdmToday();

    if (payload.assignmentCompleted && payload.assignmentContext) {
      dispatchClassroomAssignmentProgressChanged({
        classroomId: payload.assignmentContext.classroomId,
        postId: payload.assignmentContext.postId,
      });
      setAssignmentContext(null);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("classroomId");
      next.delete("postId");
      next.delete("taskId");
      router.replace(gyanDoubtsPathFromSearchParams(next), { scroll: false });
    }

    if (gyanOnboardingActive) {
      markGyanPlusCompanionPost();
      if (!isGyanPlusSubstepDone("gyan_post")) {
        recordGyanPlusSubstep("gyan_post", {
          toastActionLine: "You asked a doubt on Gyan++!",
        });
      }
      syncGyanOnboardingGuides();
    }
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <ProtectedRoute allowRoles={["student"]}>
      <AppLayout wideMain>
        <GyanDoubtsFocusTracker>
          {/* Floating Daily Gyan button: mobile only (sidebar card replaces it on desktop) */}
          <div className="lg:hidden">
            <GyanDailyChecklistTracker />
          </div>
          <div
            className={`grid min-h-0 grid-cols-1 ${gyanWallGridClass} ${gyanWallFontClass} gap-0 -mx-3 sm:-mx-4 lg:-mx-5`}
          >
              {/* Left sidebar */}
              <DoubtLeftSidebar
                profile={profile}
                strikeRate={strikeRate}
                subjectFilters={subjectFilters}
                subjectCounts={subjectCounts}
                activityView={activityView}
                sort={sort}
                filteredCount={filteredAndSorted.length}
                askedCount={askedCount}
                answeredCount={answeredCount}
                savedCount={savedCount}
                unansweredOnly={unansweredOnly}
                onToggleSubject={toggleSubject}
                onSelectAllSubjects={() => setSubjectFilters([...DOUBT_FLAIRS])}
                onClearAllSubjects={() => setSubjectFilters([])}
                onSetActivityView={setActivityView}
                onSetSort={setSort}
                onSetUnansweredOnly={setUnansweredOnly}
                dailyGyanSlot={<GyanDailyChecklistSidebarCard />}
              />

              {/* Center: header + tabs + feed */}
              <main className="order-1 lg:order-2 min-w-0 px-5 py-4 bg-[#03060e]">
                <LiveQAHeader
                  todayCount={todayCount}
                  onAskClick={handleAskClick}
                  askRewardRdm={gyanRdm.post}
                  showAskPointer={showGyanPostGuide}
                />
                {isAdmin ? (
                  <div className="mb-4">
                    <GyanBotAdminPanel />
                  </div>
                ) : null}
                <DoubtsTabBar activeTab={activeTab} onTabChange={setActiveTab} />

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAndSorted.length === 0 ? (
                  <div className="edu-card p-10 text-center rounded-2xl">
                    <p className="text-muted-foreground font-medium mb-1">No questions yet.</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      This wall is fully live from Supabase. Post the first question to start the
                      thread.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button className="rounded-xl" onClick={handleAskClick}>
                        Ask a question
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      ref={feedTopRef}
                      className="scroll-mt-[var(--app-header-sticky-offset)] space-y-3 sm:space-y-3.5"
                    >
                      {paginatedFeed.map((d, i) => (
                        <DoubtFeedCard
                          key={d.id}
                          doubt={d}
                          index={(feedPage - 1) * GYAN_FEED_PAGE_SIZE + i}
                          isSaved={savedDoubtIds.has(d.id)}
                          onToggleSave={toggleSave}
                          onRefresh={handleCommentSuccess}
                          profileAvatarUrl={profile?.avatar_url}
                          profileName={profile?.name}
                          getMyVote={(type, id) => myVotes.get(`${type}:${id}`) ?? 0}
                          onVote={handleVote}
                          currentUserId={user?.id ?? null}
                          isAdmin={isAdmin}
                          expectProfPiAnswer={Boolean(profPiPendingByDoubtId[d.id])}
                          currentUserRole={profile?.role ?? null}
                          upvoteRewardRdm={gyanRdm.upvote}
                          saveRewardRdm={gyanRdm.save}
                          teacherRewardRdm={gyanRdm.teacher}
                          commentRewardRdm={gyanRdm.comment}
                          showEngagePointer={showGyanEngageGuide && i === 0 && feedPage === 1}
                        />
                      ))}
                    </div>
                    <GyanFeedPagination
                      page={Math.min(feedPage, feedTotalPages)}
                      totalPages={feedTotalPages}
                      totalItems={filteredAndSorted.length}
                      pageSize={GYAN_FEED_PAGE_SIZE}
                      onPageChange={handleFeedPageChange}
                    />
                  </>
                )}
              </main>

              {/* Right sidebar */}
              <DoubtRightSidebar
                todayCount={todayCount}
                aiGeneratedCount={aiAuthoredDoubtCount}
                teacherTaggedCount={teacherTaggedCount}
                userRdmToday={userRdmToday}
                trending={trending}
                topContributors={topContributors}
                topTeachers={topTeachers}
                onAskClick={() => setAskOpen(true)}
                postRewardRdm={gyanRdm.post}
                wallTabKey={`${activeTab}-${activityView}`}
              />
          </div>

          <AskDoubtDialog
            open={askOpen}
            onOpenChange={setAskOpen}
            assignmentContext={assignmentContext}
            onDoubtPosted={handleDoubtPosted}
          />
        </GyanDoubtsFocusTracker>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function DoubtsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
          Loading doubts...
        </div>
      }
    >
      <DoubtsPageContent />
    </Suspense>
  );
}
