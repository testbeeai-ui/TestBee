"use client";

import { useState, useEffect, useMemo } from "react";
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
} from "@/components/doubts/doubtTypes";

import AskDoubtDialog from "@/components/doubts/AskDoubtDialog";
import LiveQAHeader from "@/components/doubts/LiveQAHeader";
import DoubtsTabBar from "@/components/doubts/DoubtsTabBar";
import DoubtFeedCard from "@/components/doubts/DoubtFeedCard";
import DoubtLeftSidebar from "@/components/doubts/DoubtLeftSidebar";
import DoubtRightSidebar from "@/components/doubts/DoubtRightSidebar";

type SimpleDoubtRow = {
  id: string;
  title: string;
  bounty_rdm?: number;
  views?: number;
  subject?: string | null;
};

export default function DoubtsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

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
  const [bountyBoard, setBountyBoard] = useState<SimpleDoubtRow[]>([]);
  const [trending, setTrending] = useState<SimpleDoubtRow[]>([]);
  const [topContributors, setTopContributors] = useState<{ user_id: string; total: number; profiles: { name: string; avatar_url: string | null } | null }[]>([]);
  const [teacherWeeklyRdm, setTeacherWeeklyRdm] = useState<Map<string, number>>(new Map());

  // UI state
  const [askOpen, setAskOpen] = useState(false);
  const [sort, setSort] = useState<SortOption>("recent");
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [activityView, setActivityView] = useState<ActivityView>("feed");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [userRdmToday, setUserRdmToday] = useState(0);

  // ─── Data fetching ───────────────────────────────────────────

  const fetchDoubts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("doubts")
        .select("*, doubt_answers(id, body, upvotes, downvotes, is_accepted, created_at, user_id, profiles!doubt_answers_user_id_fkey(name, avatar_url, role)), profiles!doubts_user_id_fkey(name, avatar_url, role)")
        .order("created_at", { ascending: false });
      if (error) {
        const isNetworkError = error.message?.includes("fetch") || error.message?.includes("Failed to fetch");
        toast({
          title: "Could not load Gyan++",
          description: isNetworkError
            ? "Network error. Check your connection and that the Supabase project is not paused."
            : error.message,
          variant: "destructive",
        });
        setDoubts([]);
      } else {
        setDoubts((data as ExpandedDoubtRow[]) || []);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network or connection error.";
      toast({
        title: "Could not load Gyan++",
        description: msg.includes("fetch") ? "Network error. Check your connection and that the Supabase project is not paused." : msg,
        variant: "destructive",
      });
      setDoubts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("profiles").select("id, name, avatar_url, rdm, lifetime_answer_rdm").eq("id", user.id).maybeSingle();
    setProfile((data as ProfileRow) || null);
  };

  const fetchStrikeRate = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("doubt_answers").select("id, is_accepted").eq("user_id", user.id);
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

  const fetchMyVotes = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("doubt_votes")
      .select("target_id, vote_type")
      .eq("user_id", user.id)
      .eq("target_type", "doubt");
    const map = new Map<string, number>();
    (data || []).forEach((r: { target_id: string; vote_type: number }) => map.set(r.target_id, r.vote_type));
    setMyVotes(map);
  };

  const fetchBountyBoard = async () => {
    const { data } = await supabase
      .from("doubts")
      .select("id, title, bounty_rdm, subject")
      .eq("is_resolved", false)
      .gt("bounty_rdm", 0)
      .order("bounty_rdm", { ascending: false })
      .limit(5);
    setBountyBoard((data as SimpleDoubtRow[]) || []);
  };

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
    const sorted = Array.from(byUser.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) { setTopContributors([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", sorted.map((s) => s[0]));
    const byId = new Map((profiles || []).map((p: { id: string; name: string; avatar_url: string | null }) => [p.id, p]));
    setTopContributors(sorted.map(([uid, total]) => ({
      user_id: uid, total,
      profiles: byId.get(uid) ? { name: (byId.get(uid) as { name: string }).name, avatar_url: (byId.get(uid) as { avatar_url: string | null }).avatar_url } : null,
    })));
  };

  const fetchUserRdmToday = async () => {
    if (!user?.id) return;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const from = todayStart.toISOString();

    const [{ data: payouts }, { data: answersToday }] = await Promise.all([
      supabase
        .from("accepted_answer_payouts")
        .select("rdm_paid")
        .eq("user_id", user.id)
        .gte("paid_at", from),
      supabase
        .from("doubt_answers")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", from),
    ]);

    const payoutRdm = (payouts ?? []).reduce(
      (sum: number, row: { rdm_paid: number }) => sum + Number(row.rdm_paid ?? 0),
      0
    );
    const answerRewardRdm = (answersToday ?? []).length * 5;
    setUserRdmToday(payoutRdm + answerRewardRdm);
  };

  // ─── Effects ─────────────────────────────────────────────────

  useEffect(() => { fetchDoubts(); }, []);
  useEffect(() => { fetchProfile(); fetchStrikeRate(); fetchSaved(); fetchAnsweredDoubtIds(); fetchMyVotes(); fetchUserRdmToday(); }, [user?.id]);
  useEffect(() => { fetchBountyBoard(); fetchTrending(); fetchTopContributors(); }, []);

  // ─── Computed data ───────────────────────────────────────────

  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DOUBT_FLAIRS.forEach((f) => { counts[f] = 0; });
    doubts.forEach((d) => { if (d.subject && d.subject in counts) counts[d.subject]++; });
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
    else if (activeTab === "teacher") list = list.filter((d) => (d.doubt_answers ?? []).some((a) => a.profiles?.role === "teacher"));
    else if (activeTab === "revision") list = list.filter((d) => savedDoubtIds.has(d.id));
    else if (activeTab === "bounties") list = list.filter((d) => (d.bounty_rdm ?? 0) > 0);
    else if (activeTab === "ai") {
      list = list.filter(
        (d) =>
          d.profiles?.role === "ai" ||
          (d.doubt_answers ?? []).some((a) => a.profiles?.role === "ai")
      );
    }

    // Subject filter
    if (subjectFilters.length > 0) list = list.filter((d) => d.subject && subjectFilters.includes(d.subject));
    if (unansweredOnly) list = list.filter((d) => !((d.doubt_answers?.length) ?? 0));

    // Sort
    if (sort === "recent") list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sort === "upvoted") list.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    else if (sort === "unanswered") list.sort((a, b) => (a.doubt_answers?.length ?? 0) - (b.doubt_answers?.length ?? 0));
    else if (sort === "bounty") list.sort((a, b) => (b.bounty_rdm ?? 0) - (a.bounty_rdm ?? 0));
    else if (sort === "teacher_tagged") list.sort((a, b) => {
      const aH = (a.doubt_answers ?? []).some((ans) => ans.profiles?.role === "teacher") ? 1 : 0;
      const bH = (b.doubt_answers ?? []).some((ans) => ans.profiles?.role === "teacher") ? 1 : 0;
      return bH - aH;
    });
    else if (sort === "saved") list.sort((a, b) => {
      return (savedDoubtIds.has(b.id) ? 1 : 0) - (savedDoubtIds.has(a.id) ? 1 : 0);
    });

    return list;
  }, [doubts, sort, subjectFilters, unansweredOnly, activityView, activeTab, user?.id, savedDoubtIds, answeredDoubtIds]);

  const askedCount = useMemo(() => (user?.id ? doubts.filter((d) => d.user_id === user.id).length : 0), [doubts, user?.id]);
  const answeredCount = answeredDoubtIds.size;
  const savedCount = savedDoubtIds.size;

  const todayCount = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return doubts.filter((d) => new Date(d.created_at) >= todayStart).length;
  }, [doubts]);

  const teacherTaggedCount = useMemo(() => {
    return doubts.filter((d) => (d.doubt_answers ?? []).some((a) => a.profiles?.role === "teacher")).length;
  }, [doubts]);

  // Compute top teachers from answers data
  const topTeachers = useMemo(() => {
    const map = new Map<string, { name: string; avatar_url: string | null; answerCount: number; rdmEarned: number; subject: string | null }>();
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

  const handleVoteFeed = async (doubtId: string, direction: 1 | -1) => {
    if (!user?.id) return;
    const current = myVotes.get(doubtId) ?? 0;
    // Optimistic UI update
    setDoubts((prev) => prev.map((d) => {
      if (d.id !== doubtId) return d;
      let up = d.upvotes;
      let down = d.downvotes;
      if (current === 1) up--;
      else if (current === -1) down--;
      if (current !== direction) {
        if (direction === 1) up++;
        else down++;
      }
      return { ...d, upvotes: up, downvotes: down };
    }));
    setMyVotes((prev) => {
      const next = new Map(prev);
      if (current === direction) next.delete(doubtId);
      else next.set(doubtId, direction);
      return next;
    });
    const { data, error } = await supabase.rpc("vote_on_doubt", {
      p_target_type: "doubt",
      p_target_id: doubtId,
      p_vote_type: direction,
    });
    if (!error && (data as { ok?: boolean })?.ok) {
      // Update with actual server counts
      const res = data as { ok: boolean; upvotes?: number; downvotes?: number };
      if (res.upvotes !== undefined && res.downvotes !== undefined) {
        setDoubts((prev) => prev.map((d) =>
          d.id === doubtId ? { ...d, upvotes: res.upvotes!, downvotes: res.downvotes! } : d
        ));
      }
    }
  };

  const toggleSubject = (flair: string) => {
    setSubjectFilters((prev) => (prev.includes(flair) ? prev.filter((s) => s !== flair) : [...prev, flair]));
  };

  const toggleSave = async (doubtId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id) return;
    const saved = savedDoubtIds.has(doubtId);
    if (saved) {
      await supabase.from("doubt_saves").delete().eq("user_id", user.id).eq("doubt_id", doubtId);
      setSavedDoubtIds((prev) => { const next = new Set(prev); next.delete(doubtId); return next; });
      toast({ title: "Removed from saved" });
    } else {
      await supabase.from("doubt_saves").insert({ user_id: user.id, doubt_id: doubtId });
      setSavedDoubtIds((prev) => new Set(prev).add(doubtId));
      toast({ title: "Saved!" });
    }
  };

  const handleDoubtPosted = () => {
    fetchDoubts();
    fetchProfile();
    fetchBountyBoard();
    fetchTrending();
    fetchTopContributors();
    fetchUserRdmToday();
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-[1680px] mx-auto px-4 sm:px-5 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 xl:gap-7">

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
              aiGeneratedCount={0}
              unansweredOnly={unansweredOnly}
              onToggleSubject={toggleSubject}
              onSelectAllSubjects={() => setSubjectFilters([...DOUBT_FLAIRS])}
              onClearAllSubjects={() => setSubjectFilters([])}
              onSetActivityView={setActivityView}
              onSetSort={setSort}
              onSetUnansweredOnly={setUnansweredOnly}
            />

            {/* Center: header + tabs + feed */}
            <main className="lg:col-span-6 order-1 lg:order-2 min-w-0">
              <LiveQAHeader
                todayCount={todayCount}
                onAskClick={() => setAskOpen(true)}
              />
              <DoubtsTabBar activeTab={activeTab} onTabChange={setActiveTab} />

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAndSorted.length === 0 ? (
                <div className="edu-card p-10 text-center rounded-2xl">
                  <p className="text-muted-foreground font-medium mb-1">No questions yet.</p>
                  <p className="text-xs text-muted-foreground mb-4">This wall is fully live from Supabase. Post the first question to start the thread.</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button className="rounded-xl" onClick={() => setAskOpen(true)}>Ask a question</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAndSorted.map((d, i) => (
                    <DoubtFeedCard
                      key={d.id}
                      doubt={d}
                      index={i}
                      isSaved={savedDoubtIds.has(d.id)}
                      onToggleSave={toggleSave}
                      onRefresh={fetchDoubts}
                      profileAvatarUrl={profile?.avatar_url}
                      profileName={profile?.name}
                      myVote={myVotes.get(d.id) ?? 0}
                      onVote={handleVoteFeed}
                    />
                  ))}
                </div>
              )}
            </main>

            {/* Right sidebar */}
            <DoubtRightSidebar
              todayCount={todayCount}
              aiGeneratedCount={doubts.filter((d) => d.profiles?.role === "ai").length}
              teacherTaggedCount={teacherTaggedCount}
              userRdmToday={userRdmToday}
              bountyBoard={bountyBoard}
              trending={trending}
              topContributors={topContributors}
              topTeachers={topTeachers}
              onAskClick={() => setAskOpen(true)}
            />
          </div>
        </div>

        <AskDoubtDialog
          open={askOpen}
          onOpenChange={setAskOpen}
          profile={profile}
          onDoubtPosted={handleDoubtPosted}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
