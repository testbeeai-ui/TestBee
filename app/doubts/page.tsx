"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  HelpCircle,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Plus,
  Loader2,
  Filter,
  Coins,
  Bookmark,
  FileQuestion,
  MessageCircle,
  ChevronLeft,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { UserHoverCard } from "@/components/UserHoverCard";

type DoubtRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  subject: string | null;
  upvotes: number;
  downvotes: number;
  is_resolved: boolean;
  bounty_rdm?: number;
  cost_rdm?: number;
  views?: number;
  created_at: string;
  doubt_answers?: { id: string }[];
  profiles?: { name: string | null; avatar_url: string | null } | null;
};

type SortOption = "recent" | "upvoted" | "unanswered" | "bounty";
const DOUBT_FLAIRS = ["Physics", "Chemistry", "Math", "Biology", "General Question", "Other"] as const;

type ActivityView = "feed" | "asked" | "answered" | "saved";

type ProfileRow = { id: string; name: string; avatar_url: string | null; rdm: number; lifetime_answer_rdm?: number };

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "").slice(0, 120);
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").slice(0, 120);
}

function rankFromLifetime(lifetime: number): string {
  if (lifetime >= 500) return "Expert";
  if (lifetime >= 100) return "Scholar";
  return "Novice";
}

function rdmToNextRank(lifetime: number): string | null {
  if (lifetime >= 500) return null;
  if (lifetime >= 100) return `${500 - lifetime} RDM to Expert`;
  return `${100 - lifetime} RDM to Scholar`;
}

export default function DoubtsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [doubts, setDoubts] = useState<DoubtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [askOpen, setAskOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [panelDemoLoading, setPanelDemoLoading] = useState(false);
  const [profileDemoLoading, setProfileDemoLoading] = useState(false);
  const [activityView, setActivityView] = useState<ActivityView>("feed");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [strikeRate, setStrikeRate] = useState<{ accepted: number; total: number } | null>(null);
  const [savedDoubtIds, setSavedDoubtIds] = useState<Set<string>>(new Set());
  const [answeredDoubtIds, setAnsweredDoubtIds] = useState<Set<string>>(new Set());
  const [bountyBoard, setBountyBoard] = useState<DoubtRow[]>([]);
  const [trending, setTrending] = useState<DoubtRow[]>([]);
  const [topContributors, setTopContributors] = useState<{ user_id: string; total: number; profiles: { name: string; avatar_url: string | null } | null }[]>([]);
  const autoSeedAttempted = useRef(false);

  // Ask modal steps: 1 = title+flair, 2 = duplicate check, 3 = familiar block, 4 = cost+bounty
  const [askStep, setAskStep] = useState(1);
  const [duplicateMatches, setDuplicateMatches] = useState<{ id: string; title: string; similarity_score: number }[]>([]);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [costRdm, setCostRdm] = useState(0);
  const [bountyRdm, setBountyRdm] = useState(0);
  const [customBountyInput, setCustomBountyInput] = useState("");

  const DRAFT_KEY = "doubts-ask-draft";
  const saveDraft = () => {
    if (typeof window === "undefined") return;
    const draft = { title, body, subject, askStep, costRdm, bountyRdm, customBountyInput, duplicateMatches };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (_) { }
  };
  const loadDraft = (): boolean => {
    if (typeof window === "undefined") return false;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw) as { title?: string; body?: string; subject?: string; askStep?: number; costRdm?: number; bountyRdm?: number; customBountyInput?: string; duplicateMatches?: { id: string; title: string; similarity_score: number }[] };
      if (d.title != null) setTitle(d.title);
      if (d.body != null) setBody(d.body);
      if (d.subject != null) setSubject(d.subject);
      if (d.askStep != null && d.askStep >= 1 && d.askStep <= 4) setAskStep(d.askStep);
      if (d.costRdm != null) setCostRdm(d.costRdm);
      if (d.bountyRdm != null) setBountyRdm(d.bountyRdm);
      if (d.customBountyInput != null) setCustomBountyInput(d.customBountyInput);
      if (Array.isArray(d.duplicateMatches)) setDuplicateMatches(d.duplicateMatches);
      return true;
    } catch (_) {
      return false;
    }
  };
  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (_) { }
  };

  const fetchDoubts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("doubts")
        .select("*, doubt_answers(id), profiles!doubts_user_id_fkey(name, avatar_url)")
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
        setDoubts((data as DoubtRow[]) || []);
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

  useEffect(() => {
    fetchDoubts();
  }, []);

  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("profiles").select("id, name, avatar_url, rdm, lifetime_answer_rdm").eq("id", user.id).maybeSingle();
    setProfile((data as ProfileRow) || null);
  };

  const fetchStrikeRate = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("doubt_answers").select("id, is_accepted").eq("user_id", user.id);
    const list = (data || []) as { id: string; is_accepted: boolean }[];
    const total = list.length;
    const accepted = list.filter((a) => a.is_accepted).length;
    setStrikeRate({ accepted, total });
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

  const fetchBountyBoard = async () => {
    const { data } = await supabase
      .from("doubts")
      .select("*, doubt_answers(id)")
      .eq("is_resolved", false)
      .gt("bounty_rdm", 0)
      .order("bounty_rdm", { ascending: false })
      .limit(5);
    setBountyBoard((data as DoubtRow[]) || []);
  };

  const fetchTrending = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceIso = since.toISOString();
    const { data } = await supabase
      .from("doubts")
      .select("*, doubt_answers(id)")
      .gte("created_at", sinceIso)
      .order("views", { ascending: false })
      .order("upvotes", { ascending: false })
      .limit(5);
    setTrending((data as DoubtRow[]) || []);
  };

  const fetchTopContributors = async () => {
    const { data } = await supabase
      .from("accepted_answer_payouts")
      .select("user_id, rdm_paid, paid_at")
      .gte("paid_at", getWeekStart());
    const list = (data || []) as { user_id: string; rdm_paid: number }[];
    const byUser = new Map<string, number>();
    list.forEach((r) => byUser.set(r.user_id, (byUser.get(r.user_id) || 0) + r.rdm_paid));
    const sorted = Array.from(byUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (sorted.length === 0) {
      setTopContributors([]);
      return;
    }
    const { data: profiles } = await supabase.from("profiles").select("id, name, avatar_url").in("id", sorted.map((s) => s[0]));
    const byId = new Map((profiles || []).map((p: { id: string; name: string; avatar_url: string | null }) => [p.id, p]));
    setTopContributors(sorted.map(([user_id, total]) => ({ user_id, total, profiles: byId.get(user_id) ? { name: (byId.get(user_id) as { name: string }).name, avatar_url: (byId.get(user_id) as { avatar_url: string | null }).avatar_url } : null })));
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

  useEffect(() => {
    fetchProfile();
    fetchStrikeRate();
    fetchSaved();
    fetchAnsweredDoubtIds();
  }, [user?.id]);

  useEffect(() => {
    fetchBountyBoard();
    fetchTrending();
    fetchTopContributors();
  }, []);

  useEffect(() => {
    if (!user || loading || doubts.length > 0 || seedLoading || autoSeedAttempted.current) return;
    autoSeedAttempted.current = true;
    seedDemo(false);
  }, [user, loading, doubts.length, seedLoading]);

  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DOUBT_FLAIRS.forEach((f) => { counts[f] = 0; });
    doubts.forEach((d) => {
      if (d.subject && d.subject in counts) counts[d.subject]++;
    });
    return counts;
  }, [doubts]);

  const filteredAndSorted = useMemo(() => {
    let list = [...doubts];
    if (activityView === "asked" && user?.id) list = list.filter((d) => d.user_id === user.id);
    else if (activityView === "saved") list = list.filter((d) => savedDoubtIds.has(d.id));
    else if (activityView === "answered") list = list.filter((d) => answeredDoubtIds.has(d.id));
    if (subjectFilters.length > 0) list = list.filter((d) => d.subject && subjectFilters.includes(d.subject));
    if (unansweredOnly) list = list.filter((d) => !((d.doubt_answers?.length) ?? 0));
    if (sort === "recent") list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sort === "upvoted") list.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
    else if (sort === "unanswered") list.sort((a, b) => (a.doubt_answers?.length ?? 0) - (b.doubt_answers?.length ?? 0));
    else if (sort === "bounty") list.sort((a, b) => (b.bounty_rdm ?? 0) - (a.bounty_rdm ?? 0));
    return list;
  }, [doubts, sort, subjectFilters, unansweredOnly, activityView, user?.id, savedDoubtIds, answeredDoubtIds]);

  const askedCount = useMemo(() => (user?.id ? doubts.filter((d) => d.user_id === user.id).length : 0), [doubts, user?.id]);
  const answeredCount = answeredDoubtIds.size;
  const savedCount = savedDoubtIds.size;

  // Sample data for panels when empty so users see what Bounty Board, Trending, Top Contributors look like
  const sampleBounty = useMemo(
    () => doubts.slice(0, 5).map((d, i) => ({ ...d, bounty_rdm: [50, 30, 20, 15, 10][i] ?? 10 })),
    [doubts]
  );
  const sampleTrending = useMemo(
    () => doubts.slice(0, 5).map((d, i) => ({ ...d, views: [120, 85, 64, 41, 28][i] ?? 20 })),
    [doubts]
  );
  const SAMPLE_CONTRIBUTORS = [
    { name: profile?.name ?? "You", total: 45 },
    { name: "Demo User", total: 32 },
    { name: "Scholar", total: 28 },
    { name: "Expert", total: 18 },
    { name: "Helper", total: 12 },
  ];

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
      setSavedDoubtIds((prev) => {
        const next = new Set(prev);
        next.delete(doubtId);
        return next;
      });
      toast({ title: "Removed from saved" });
    } else {
      await supabase.from("doubt_saves").insert({ user_id: user.id, doubt_id: doubtId });
      setSavedDoubtIds((prev) => new Set(prev).add(doubtId));
      toast({ title: "Saved!" });
    }
  };

  const selectAllSubjects = () => setSubjectFilters([...DOUBT_FLAIRS]);
  const clearAllSubjects = () => setSubjectFilters([]);

  const seedDemo = async (showToast = true) => {
    setSeedLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
      const res = await fetch("/api/seed-doubts", { method: "POST", credentials: "include", headers });
      const data = await res.json();
      if (!res.ok) {
        if (showToast) toast({ title: data?.error ?? "Seed failed", variant: "destructive" });
        return false;
      }
      if (data.seeded) {
        if (showToast) toast({ title: "Demo doubts added!" });
        fetchDoubts();
        return true;
      }
      return false;
    } finally {
      setSeedLoading(false);
    }
  };

  const seedPanelDemo = async () => {
    setPanelDemoLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
      const res = await fetch("/api/seed-doubts-demo-panels", { method: "POST", credentials: "include", headers });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data?.error ?? "Failed to load panel demo", variant: "destructive" });
        return;
      }
      const r = data.results ?? {};
      const msg = [r.bountyBoard > 0 && `${r.bountyBoard} Bounty Board`, r.trending > 0 && `${r.trending} Trending`, r.topContributors > 0 && `${r.topContributors} Top Contributors`].filter(Boolean).join(", ");
      toast({ title: msg ? `Demo data added: ${msg}` : "Demo data ran. Refreshing panels…" });
      await Promise.all([fetchDoubts(), fetchBountyBoard(), fetchTrending(), fetchTopContributors()]);
    } finally {
      setPanelDemoLoading(false);
    }
  };

  const seedProfileDemo = async () => {
    setProfileDemoLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
      const res = await fetch("/api/seed-profile-demo", { method: "POST", credentials: "include", headers });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data?.error ?? "Failed to load profile demo", variant: "destructive" });
        return;
      }
      const r = data.results ?? {};
      const msg = r.profilesCreated
        ? `Created ${r.profilesCreated} missing profile(s). ${r.academicsAdded} academics, ${r.achievementsAdded} achievements added.`
        : r.usersSeeded
          ? `Profiles seeded for ${r.usersSeeded} users (${r.academicsAdded} academics, ${r.achievementsAdded} achievements)`
          : "Profile demo data ran.";
      toast({ title: msg });
    } finally {
      setProfileDemoLoading(false);
    }
  };

  const handleAskDoubtStart = () => {
    const hadDraft = loadDraft();
    if (!hadDraft) {
      setAskStep(1);
      setTitle("");
      setBody("");
      setSubject("");
      setDuplicateMatches([]);
      setCostRdm(0);
      setBountyRdm(0);
      setCustomBountyInput("");
    }
    setAskOpen(true);
  };

  useEffect(() => {
    if (askOpen) saveDraft();
  }, [askOpen, title, body, subject, askStep, costRdm, bountyRdm, customBountyInput, duplicateMatches]);

  const handleAskStep1Next = () => {
    if (!title.trim() || !subject || !DOUBT_FLAIRS.includes(subject as (typeof DOUBT_FLAIRS)[number])) {
      toast({ title: "Title and subject required", variant: "destructive" });
      return;
    }
    setDuplicateChecking(true);
    setAskStep(2);
    supabase
      .rpc("search_doubt_duplicates", { p_title: title.trim() })
      .then(({ data, error }) => {
        setDuplicateChecking(false);
        if (error) {
          setDuplicateMatches([]);
          setAskStep(4);
          return;
        }
        const rows = (data || []) as { id: string; title: string; similarity_score: number }[];
        const SIMILARITY_THRESHOLD = 0.35;
        const similar = rows.filter((r) => r.similarity_score >= SIMILARITY_THRESHOLD);
        if (similar.length > 0) {
          setDuplicateMatches(similar);
          setAskStep(3);
        } else {
          setDuplicateMatches([]);
          setAskStep(4);
        }
      });
  };

  const handleDuplicateDifferent = () => {
    setDuplicateMatches([]);
    setAskStep(4);
  };

  const handleAskSubmit = async () => {
    if (!user?.id || !title.trim()) return;
    const flair = subject.trim();
    if (!flair || !DOUBT_FLAIRS.includes(flair as (typeof DOUBT_FLAIRS)[number])) {
      toast({ title: "Please select a subject", variant: "destructive" });
      return;
    }
    setSubmitLoading(true);
    const { data, error } = await supabase.rpc("create_doubt_with_escrow", {
      p_title: title.trim(),
      p_body: body.trim() || "",
      p_subject: flair,
      p_cost_rdm: costRdm,
      p_bounty_rdm: bountyRdm,
    });
    setSubmitLoading(false);
    const res = data as { ok: boolean; id?: string; error?: string };
    if (error) {
      toast({ title: "Could not post doubt", description: error.message, variant: "destructive" });
      return;
    }
    if (res?.ok) {
      clearDraft();
      toast({ title: "Doubt posted!" });
      setAskOpen(false);
      fetchDoubts();
      fetchProfile();
      fetchBountyBoard();
    } else {
      toast({ title: res?.error ?? "Failed to post", variant: "destructive" });
    }
  };

  const onAskOpenChange = (open: boolean) => {
    if (!open) setAskOpen(false);
  };

  const handleAskBack = () => {
    setAskStep(1);
  };

  const handleStartAsNew = () => {
    clearDraft();
    setAskStep(1);
    setTitle("");
    setBody("");
    setSubject("");
    setDuplicateMatches([]);
    setCostRdm(0);
    setBountyRdm(0);
    setCustomBountyInput("");
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Left column: sticky profile + filters + activity */}
            <aside className="lg:col-span-3 xl:col-span-3 order-2 lg:order-1 min-w-0">
              <div className="lg:sticky lg:top-4 space-y-6">
                <TooltipProvider>
                  <div className="edu-card p-4 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-12 w-12 rounded-xl shrink-0">
                        <AvatarImage src={profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="rounded-xl">{(profile?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground truncate">{profile?.name ?? "You"}</p>
                        <p className="flex items-center gap-1 text-sm text-edu-orange font-semibold">
                          <Coins className="w-4 h-4 shrink-0" /> {profile?.rdm ?? 0} RDM
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          {strikeRate && strikeRate.total > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help inline-flex items-center gap-0.5">
                                  Strike rate: {Math.round((strikeRate.accepted / strikeRate.total) * 100)}%
                                  <Info className="w-3 h-3" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right">Accepted answers ÷ total answers you&apos;ve given</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span>Strike rate: —</span>
                          )}
                          <span className="text-edu-green font-medium">{rankFromLifetime(profile?.lifetime_answer_rdm ?? 0)}</span>
                          {rdmToNextRank(profile?.lifetime_answer_rdm ?? 0) && (
                            <span>{rdmToNextRank(profile?.lifetime_answer_rdm ?? 0)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="edu-card p-4 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-foreground">My Subjects</p>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs rounded-lg" onClick={selectAllSubjects}>All</Button>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs rounded-lg" onClick={clearAllSubjects}>Clear</Button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {DOUBT_FLAIRS.map((flair) => (
                        <label key={flair} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5">
                          <input
                            type="checkbox"
                            checked={subjectFilters.includes(flair)}
                            onChange={() => toggleSubject(flair)}
                            className="rounded"
                          />
                          {flair} <span className="text-muted-foreground">({subjectCounts[flair] ?? 0})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="edu-card p-4 rounded-2xl">
                    <p className="text-sm font-bold text-foreground mb-2">My Activity</p>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className={`text-left text-sm py-1.5 px-2 rounded-lg flex items-center justify-between w-full ${activityView === "feed" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                        onClick={() => setActivityView("feed")}
                      >
                        <span className="flex items-center gap-1.5">All doubts</span>
                        <span className={activityView === "feed" ? "text-primary tabular-nums font-medium" : "text-muted-foreground tabular-nums"}>{filteredAndSorted.length}</span>
                      </button>
                      <button
                        type="button"
                        className={`text-left text-sm py-1.5 px-2 rounded-lg flex items-center justify-between w-full ${activityView === "asked" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                        onClick={() => setActivityView("asked")}
                      >
                        <span className="flex items-center gap-1.5"><FileQuestion className={`w-4 h-4 shrink-0 ${activityView === "asked" ? "text-primary" : "text-muted-foreground"}`} /> Questions I Asked</span>
                        <span className={activityView === "asked" ? "text-primary tabular-nums font-medium" : "text-muted-foreground tabular-nums"}>({askedCount})</span>
                      </button>
                      <button
                        type="button"
                        className={`text-left text-sm py-1.5 px-2 rounded-lg flex items-center justify-between w-full ${activityView === "answered" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                        onClick={() => setActivityView("answered")}
                      >
                        <span className="flex items-center gap-1.5"><MessageCircle className={`w-4 h-4 shrink-0 ${activityView === "answered" ? "text-primary" : "text-muted-foreground"}`} /> Questions I Answered</span>
                        <span className={activityView === "answered" ? "text-primary tabular-nums font-medium" : "text-muted-foreground tabular-nums"}>({answeredCount})</span>
                      </button>
                      <button
                        type="button"
                        className={`text-left text-sm py-1.5 px-2 rounded-lg flex items-center justify-between w-full ${activityView === "saved" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"}`}
                        onClick={(e) => { e.preventDefault(); setActivityView("saved"); }}
                      >
                        <span className="flex items-center gap-1.5"><Bookmark className={`w-4 h-4 shrink-0 ${activityView === "saved" ? "text-primary" : "text-muted-foreground"}`} /> Saved Doubts</span>
                        <span className={activityView === "saved" ? "text-primary tabular-nums font-medium" : "text-muted-foreground tabular-nums"}>({savedCount})</span>
                      </button>
                    </div>
                  </div>
                </TooltipProvider>
              </div>
            </aside>

            {/* Center: ask bar + feed */}
            <main className="lg:col-span-6 xl:col-span-5 order-1 lg:order-2 min-w-0">
              <div className="edu-page-header mb-4">
                <h2 className="edu-page-title flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
                    <HelpCircle className="w-5 h-5 text-primary" />
                  </div>
                  Gyan++
                </h2>
                <p className="edu-page-desc">Ask and answer. Earn RDM for helpful answers.</p>
              </div>
              <div className="mb-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="What's your doubt?"
                    className="rounded-xl flex-1"
                    onFocus={() => setAskOpen(true)}
                    readOnly
                  />
                  <Button className="rounded-xl shrink-0" onClick={handleAskDoubtStart}>
                    <Plus className="w-4 h-4 mr-2" /> Ask
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Click Ask → enter title & subject → then in the last step you can add an <strong>optional bounty</strong> (+10, +50, +100 RDM) to attract answers.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                  <Filter className="w-4 h-4" /> Sort:
                </span>
                {(["recent", "upvoted", "unanswered", "bounty"] as const).map((s) => (
                  <Button key={s} variant={sort === s ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setSort(s)}>
                    {s === "recent" ? "Recent" : s === "upvoted" ? "Most upvoted" : s === "unanswered" ? "Unanswered" : "Highest bounty"}
                  </Button>
                ))}
                <label className="flex items-center gap-2 ml-2 text-sm">
                  <input type="checkbox" checked={unansweredOnly} onChange={(e) => setUnansweredOnly(e.target.checked)} className="rounded" />
                  Unanswered only
                </label>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAndSorted.length === 0 ? (
                <div className="edu-card p-10 text-center">
                  <p className="text-muted-foreground">No questions yet. Be the first to ask or load demo data.</p>
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                    <Button className="rounded-xl" onClick={handleAskDoubtStart}>Ask a question</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => seedDemo(true)} disabled={seedLoading}>
                      {seedLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Load demo data
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAndSorted.map((d, i) => (
                    <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <div className="edu-card p-5 rounded-2xl hover:border-primary/40 hover:shadow-md transition-all duration-200">
                        <div className="flex gap-4">
                          <Link
                            href={`/doubts/${d.id}`}
                            className="flex flex-col items-center shrink-0 w-10 text-muted-foreground hover:text-foreground"
                          >
                            <ChevronUp className="w-5 h-5" />
                            <span className="font-bold text-foreground text-sm tabular-nums">{d.upvotes - d.downvotes}</span>
                            <ChevronDown className="w-5 h-5" />
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <UserHoverCard userId={d.user_id}>
                                <div className="flex items-center gap-2 shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                                  <Avatar className="h-7 w-7 rounded-full shrink-0">
                                    <AvatarImage src={d.profiles?.avatar_url ?? undefined} />
                                    <AvatarFallback className="rounded-full text-xs">{(d.profiles?.name ?? "S").slice(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm font-medium text-foreground truncate">{d.profiles?.name ?? "Student"}</span>
                                    {!d.profiles && (
                                      <span className="text-xs text-muted-foreground shrink-0">· No marks</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {new Date(d.created_at).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                  </span>
                                </div>
                              </UserHoverCard>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-lg h-8 w-8 shrink-0 text-muted-foreground hover:text-primary -mr-1"
                                onClick={(e) => toggleSave(d.id, e)}
                                title={savedDoubtIds.has(d.id) ? "Unsave" : "Save"}
                              >
                                <Bookmark className={`w-4 h-4 ${savedDoubtIds.has(d.id) ? "fill-current text-primary" : ""}`} />
                              </Button>
                            </div>
                            <Link href={`/doubts/${d.id}`} className="block mt-2">
                              <h3 className="font-bold text-foreground line-clamp-1">{d.title}</h3>
                              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{stripHtml(d.body) || "No description."}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {d.subject && <span className="edu-chip bg-primary/10 text-primary text-xs">{d.subject}</span>}
                                {d.is_resolved && <span className="edu-chip bg-edu-green/10 text-edu-green text-xs">Resolved</span>}
                                {(d.bounty_rdm ?? 0) > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-edu-orange/20 text-edu-orange text-xs font-semibold px-2.5 py-0.5 border border-edu-orange/30">
                                    +{d.bounty_rdm} RDM
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MessageSquare className="w-3.5 h-3.5" /> {d.doubt_answers?.length ?? 0}
                                </span>
                              </div>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </main>

            {/* Right: Bounty Board, Trending, Top Contributors */}
            <aside className="lg:col-span-3 xl:col-span-4 order-3 min-w-0 max-w-full">
              <div className="lg:sticky lg:top-4 space-y-6">
                <div className="edu-card p-4 rounded-2xl border-dashed border-2 border-primary/30 bg-primary/5 min-w-0">
                  <p className="text-sm font-medium text-foreground mb-1">See how these panels work?</p>
                  <p className="text-xs text-muted-foreground mb-3">The panels below show <strong>sample data</strong> until real data is loaded. Click to seed demo data.</p>
                  <div className="flex flex-col gap-3">
                    <Button
                      variant="default"
                      size="sm"
                      className="rounded-xl w-full min-h-[36px] shrink-0"
                      onClick={seedPanelDemo}
                      disabled={panelDemoLoading}
                    >
                      {panelDemoLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Load panel demo data"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl w-full min-h-[36px] text-left whitespace-normal py-2 h-auto shrink-0"
                      onClick={seedProfileDemo}
                      disabled={profileDemoLoading}
                    >
                      {profileDemoLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : (
                        <span className="block">
                          <span className="hidden sm:inline">Load profile demo data (academics & achievements)</span>
                          <span className="sm:hidden">Load profile demo data</span>
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="edu-card p-4 rounded-2xl min-w-0">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-edu-orange shrink-0" /> Bounty Board
                    {bountyBoard.length > 0 ? <span className="text-[10px] font-normal normal-case bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">Live</span> : <span className="text-[10px] font-normal normal-case bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Sample</span>}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">Top unresolved bounties</p>
                  <ul className="space-y-2">
                    {bountyBoard.length > 0 ? bountyBoard.map((d) => (
                      <li key={d.id}>
                        <Link href={`/doubts/${d.id}`} className="flex items-start gap-1.5 text-sm font-medium text-foreground hover:text-primary line-clamp-2 group">
                          <Coins className="w-3.5 h-3.5 text-edu-orange shrink-0 mt-0.5" />
                          <span className="group-hover:underline"><span className="text-edu-orange font-semibold">+{d.bounty_rdm ?? 0} RDM</span> · {d.title}</span>
                        </Link>
                      </li>
                    )) : sampleBounty.length > 0 ? sampleBounty.map((d) => (
                      <li key={d.id}>
                        <Link href={`/doubts/${d.id}`} className="flex items-start gap-1.5 text-sm font-medium text-foreground hover:text-primary line-clamp-2 group">
                          <Coins className="w-3.5 h-3.5 text-edu-orange shrink-0 mt-0.5" />
                          <span className="group-hover:underline"><span className="text-edu-orange font-semibold">+{d.bounty_rdm} RDM</span> · {d.title}</span>
                        </Link>
                      </li>
                    )) : <li className="text-sm text-muted-foreground">None</li>}
                  </ul>
                </div>
                <div className="edu-card p-4 rounded-2xl min-w-0">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-primary shrink-0" /> Trending Now
                    {trending.length > 0 ? <span className="text-[10px] font-normal normal-case bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">Live</span> : <span className="text-[10px] font-normal normal-case bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Sample</span>}
                  </h3>
                  <ul className="space-y-2">
                    {trending.length > 0 ? trending.map((d) => (
                      <li key={d.id}>
                        <Link href={`/doubts/${d.id}`} className="text-sm text-foreground hover:text-primary line-clamp-2 block hover:underline">
                          {d.title}
                          {(d.views ?? 0) > 0 && <span className="text-muted-foreground text-xs ml-1">({d.views} views)</span>}
                        </Link>
                      </li>
                    )) : sampleTrending.length > 0 ? sampleTrending.map((d) => (
                      <li key={d.id}>
                        <Link href={`/doubts/${d.id}`} className="text-sm text-foreground hover:text-primary line-clamp-2 block hover:underline">
                          {d.title}
                          <span className="text-muted-foreground text-xs ml-1">({d.views} views)</span>
                        </Link>
                      </li>
                    )) : <li className="text-sm text-muted-foreground">None</li>}
                  </ul>
                </div>
                <div className="edu-card p-4 rounded-2xl min-w-0">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-edu-orange shrink-0" /> Top Contributors (this week)
                    {topContributors.length > 0 ? null : <span className="text-[10px] font-normal normal-case bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Sample</span>}
                  </h3>
                  <ul className="space-y-2">
                    {topContributors.length > 0 ? topContributors.map((c, i) => (
                      <li key={c.user_id} className="flex items-center justify-between gap-2">
                        <UserHoverCard userId={c.user_id}>
                          <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity">
                            <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                              {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}`}
                            </span>
                            <Avatar className="h-7 w-7 rounded-lg shrink-0">
                              <AvatarImage src={c.profiles?.avatar_url ?? undefined} />
                              <AvatarFallback className="rounded-lg text-xs">{(c.profiles?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="truncate text-sm font-medium">{c.profiles?.name ?? "Someone"}</span>
                          </div>
                        </UserHoverCard>
                        <span className="text-edu-orange font-semibold text-sm shrink-0">{c.total} RDM</span>
                      </li>
                    )) : SAMPLE_CONTRIBUTORS.map((c, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                            {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}`}
                          </span>
                          <Avatar className="h-7 w-7 rounded-lg shrink-0">
                            <AvatarFallback className="rounded-lg text-xs">{(c.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm font-medium">{c.name}</span>
                        </div>
                        <span className="text-edu-orange font-semibold text-sm shrink-0">{c.total} RDM</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <Dialog open={askOpen} onOpenChange={onAskOpenChange}>
          <DialogContent className="rounded-2xl max-w-lg">
            <DialogHeader>
              <DialogTitle>Ask a Doubt</DialogTitle>
              <DialogDescription>
                {askStep === 1 && "Enter title and pick a subject."}
                {askStep === 2 && "Checking for similar questions..."}
                {askStep === 3 && "We found similar questions. Is yours here?"}
                {askStep === 4 && "Cost and optional bounty (during beta cost is 0)."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {askStep === 1 && (
                <>
                  <div>
                    <Label className="text-sm font-bold">Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How do I integrate x^2 e^x?" className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm font-bold">Details (optional)</Label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Add more context..."
                      className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm mt-1 resize-y"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-bold">Subject <span className="text-destructive">*</span></Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {DOUBT_FLAIRS.map((flair) => (
                        <Button key={flair} type="button" variant={subject === flair ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setSubject(flair)}>{flair}</Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {askStep === 2 && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}
              {askStep === 3 && duplicateMatches.length > 0 && (
                <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
                  <p className="font-semibold text-foreground">Similar questions we found:</p>
                  <ul className="space-y-2">
                    {duplicateMatches.map((m) => (
                      <li key={m.id}>
                        <Link href={`/doubts/${m.id}`} className="text-sm text-primary hover:underline line-clamp-2 block py-1" onClick={() => setAskOpen(false)}>
                          {m.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">Open any link above if it answers your question, or continue to post yours.</p>
                </div>
              )}
              {askStep === 4 && (
                <>
                  <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium text-foreground">Base cost: {costRdm} RDM <span className="text-muted-foreground font-normal">(0 during beta)</span></p>
                    <p className="text-xs text-muted-foreground">Your balance: <span className="font-semibold text-edu-orange">{profile?.rdm ?? 0} RDM</span></p>
                    <p className="text-sm font-medium text-foreground mt-2">Optional bounty</p>
                    <p className="text-xs text-muted-foreground">Adding a bounty increases visibility and incentivizes quick, quality answers. The amount is held until someone&apos;s answer is accepted.</p>
                    <div className="flex flex-wrap gap-2 items-center mt-2">
                      {[0, 10, 50, 100].map((n) => (
                        <Button
                          key={n}
                          type="button"
                          variant={bountyRdm === n && !customBountyInput ? "default" : "outline"}
                          size="sm"
                          className="rounded-xl"
                          onClick={() => { setBountyRdm(n); setCustomBountyInput(""); }}
                        >
                          +{n} RDM
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Label className="text-sm font-medium text-muted-foreground shrink-0">Edit / Custom amount:</Label>
                      <Input
                        type="number"
                        min={0}
                        max={Math.max(999, profile?.rdm ?? 0)}
                        placeholder="e.g. 25"
                        className="rounded-xl w-24 h-8"
                        value={customBountyInput !== "" ? customBountyInput : ([0, 10, 50, 100].includes(bountyRdm) ? "" : String(bountyRdm))}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCustomBountyInput(v);
                          const n = parseInt(v, 10);
                          if (!Number.isNaN(n) && n >= 0) setBountyRdm(n);
                          else if (v === "") setBountyRdm(0);
                        }}
                      />
                      <span className="text-xs text-muted-foreground">RDM</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground pt-2 border-t border-border mt-2">
                      Total: {costRdm + bountyRdm} RDM {profile != null && costRdm + bountyRdm > (profile.rdm ?? 0) && <span className="text-destructive text-xs font-normal">(insufficient balance)</span>}
                    </p>
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:gap-2">
              {askStep === 1 && (
                <>
                  <Button variant="outline" className="rounded-xl" onClick={() => onAskOpenChange(false)}>Cancel</Button>
                  <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={handleStartAsNew}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Start as new
                  </Button>
                  <Button className="rounded-xl" onClick={handleAskStep1Next} disabled={!title.trim() || !subject || duplicateChecking}>
                    {duplicateChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Continue
                  </Button>
                </>
              )}
              {askStep === 3 && (
                <>
                  <Button variant="outline" className="rounded-xl" onClick={handleAskBack}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button className="rounded-xl" onClick={handleDuplicateDifferent}>My question is different — continue</Button>
                </>
              )}
              {askStep === 4 && (
                <>
                  <Button variant="outline" className="rounded-xl" onClick={handleAskBack}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => onAskOpenChange(false)}>Cancel</Button>
                  <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={handleStartAsNew}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Start as new
                  </Button>
                  <Button
                    className="rounded-xl"
                    onClick={handleAskSubmit}
                    disabled={submitLoading || (profile != null && costRdm + bountyRdm > (profile.rdm ?? 0))}
                  >
                    {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Post
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ProtectedRoute>
  );
}