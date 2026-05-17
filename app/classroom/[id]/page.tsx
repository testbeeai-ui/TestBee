"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/safeSession";
import AppLayout from "@/components/AppLayout";
import {
  Copy,
  Users,
  BookOpen,
  Settings,
  Home,
  MessageSquare,
  Video,
  Plus,
  Calendar,
  Clock,
  UserPlus,
  Check,
  X,
  Loader2,
  UserMinus,
  Star,
} from "lucide-react";
import ClassroomReviews from "@/components/ClassroomReviews";
import ReviewPopup from "@/components/ReviewPopup";
import { StarRatingBadge } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ClassFeed, { type FeedCountsPayload, type Post } from "@/components/ClassFeed";
import PostComposer from "@/components/PostComposer";
import PostDetailModal from "@/components/PostDetailModal";
import InviteStudents from "@/components/InviteStudents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

interface ClassroomData {
  id: string;
  name: string;
  section: string | null;
  subject: string | null;
  description: string | null;
  intro_video_url?: string | null;
  join_code: string;
  teacher_id: string;
  google_classroom_id?: string | null;
  google_meet_link?: string | null;
}

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  section_id: string | null;
  profiles: { name: string; avatar_url: string | null } | null;
}

interface JoinRequest {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  profiles: { name: string } | null;
}

interface LiveSession {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meet_link: string | null;
  status: string;
  section_id?: string | null;
}

type Tab = "home" | "posts" | "live" | "members" | "reviews" | "settings";

/** Session is joinable from 30 min before start until end of class (+ 15 min buffer). No joining earlier to avoid storage/bandwidth. */
function getSessionJoinStatus(
  scheduled_at: string,
  duration_minutes: number
): "live" | "upcoming" | "ended" {
  const start = new Date(scheduled_at).getTime();
  const joinFrom = start - 30 * 60 * 1000;
  const joinUntil = start + (duration_minutes + 15) * 60 * 1000;
  const now = Date.now();
  if (now < joinFrom) return "upcoming";
  if (now > joinUntil) return "ended";
  return "live";
}

const tabs: { id: Tab; label: string; icon: typeof Home; emoji: string }[] = [
  { id: "home", label: "Home", icon: Home, emoji: "🏠" },
  { id: "posts", label: "Posts", icon: MessageSquare, emoji: "📝" },
  { id: "live", label: "Live", icon: Video, emoji: "🎥" },
  { id: "members", label: "Members", icon: Users, emoji: "👥" },
  { id: "reviews", label: "Reviews", icon: Star, emoji: "⭐" },
  { id: "settings", label: "Settings", icon: Settings, emoji: "⚙️" },
];

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getEmbedUrl } from "@/lib/videoEmbed";
import { normalizeMeetLink } from "@/lib/meetLink";

const ClassroomDetail = () => {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string | undefined;
  const { user, profile, session, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [classroom, setClassroom] = useState<ClassroomData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showComposer, setShowComposer] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState(60);
  const [meetLinkPaste, setMeetLinkPaste] = useState("");
  const [scheduleSectionId, setScheduleSectionId] = useState<string | null>(null);
  const [scheduleSectionOptions, setScheduleSectionOptions] = useState<
    Array<{ id: string; name: string; googleMeetLink: string | null }>
  >([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [settingsIntroVideoUrl, setSettingsIntroVideoUrl] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postCount, setPostCount] = useState<number>(0);
  /** Student-visible post total from ClassFeed (RLS-scoped fetch); overrides sidebar when set. */
  const [studentSidebarPostTotal, setStudentSidebarPostTotal] = useState<number | null>(null);
  const [assigningSectionUserId, setAssigningSectionUserId] = useState<string | null>(null);
  const [explorationAllowed, setExplorationAllowed] = useState<boolean | null>(null);
  const [explorerJoinRequestStatus, setExplorerJoinRequestStatus] = useState<
    "none" | "pending" | "rejected" | null
  >(null);
  const [explorerRequestingJoin, setExplorerRequestingJoin] = useState(false);
  const [explorerPosts, setExplorerPosts] = useState<Post[] | null>(null);
  const [classRating, setClassRating] = useState<{
    avg_rating: number;
    review_count: number;
  } | null>(null);
  /** Owner-only: admin-approved teachers may use classroom teacher controls (matches teacher portal policy). */
  const [ownerTeacherGate, setOwnerTeacherGate] = useState<{ ready: boolean; approved: boolean }>({
    ready: false,
    approved: false,
  });

  // Deep-link support: /classroom/:id?tab=posts&post=<postId>
  useEffect(() => {
    if (!id) return;
    const tab = searchParams.get("tab");
    const postId = searchParams.get("post");
    if (tab === "posts") setActiveTab("posts");
    if (!postId?.trim()) return;

    let cancelled = false;
    const run = async () => {
      try {
        const { data } = await supabase
          .from("posts")
          .select("*, profiles!posts_teacher_id_fkey(name)")
          .eq("id", postId.trim())
          .maybeSingle();
        if (cancelled) return;
        if (data) setSelectedPost(data as unknown as Post);
      } catch {
        // ignore
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams]);
  useEffect(() => {
    if (activeTab === "settings" && classroom) {
      setSettingsIntroVideoUrl(classroom.intro_video_url ?? "");
      setSettingsDescription(classroom.description ?? "");
    }
  }, [activeTab, classroom?.id, classroom?.intro_video_url, classroom?.description]);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const { data: c } = await supabase.from("classrooms").select("*").eq("id", id).maybeSingle();
      setClassroom(c as ClassroomData | null);

      const { data: m } = await supabase
        .from("classroom_members")
        .select("user_id, role, joined_at, section_id, profiles(name, avatar_url)")
        .eq("classroom_id", id);
      setMembers((m as Member[]) || []);

      const { data: sessions } = await supabase
        .from("live_sessions")
        .select("id, title, scheduled_at, duration_minutes, meet_link, status, section_id")
        .eq("classroom_id", id)
        .order("scheduled_at", { ascending: true });
      setLiveSessions((sessions as LiveSession[]) || []);

      const { count } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("classroom_id", id);
      setPostCount(count ?? 0);

      // Fetch rating summary
      const { data: reviews } = await supabase
        .from("classroom_reviews" as never)
        .select("rating")
        .eq("classroom_id", id);
      const reviewRows = (reviews as unknown as { rating: number }[]) || [];
      if (reviewRows.length > 0) {
        const avg = reviewRows.reduce((s, r) => s + r.rating, 0) / reviewRows.length;
        setClassRating({ avg_rating: Math.round(avg * 10) / 10, review_count: reviewRows.length });
      }

      setLoading(false);
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (!user?.id || !classroom) return;
    if (classroom.teacher_id !== user.id) {
      setOwnerTeacherGate({ ready: true, approved: false });
      return;
    }
    setOwnerTeacherGate({ ready: false, approved: false });
    let cancelled = false;
    void (
      supabase as unknown as {
        from: (name: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: { verification_status?: string | null } | null;
                error: { message?: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("teacher_profile_details")
      .select("verification_status")
      .eq("teacher_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setOwnerTeacherGate({ ready: true, approved: false });
          return;
        }
        const st = (data?.verification_status as string | undefined) ?? "unverified";
        setOwnerTeacherGate({ ready: true, approved: st === "approved" });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, classroom?.id, classroom?.teacher_id]);

  useEffect(() => {
    if (!scheduleOpen) return;
    // Default meet link based on selected scope (section > class).
    if (scheduleSectionId) {
      const sec = scheduleSectionOptions.find((s) => s.id === scheduleSectionId);
      if (sec?.googleMeetLink?.trim()) {
        setMeetLinkPaste(sec.googleMeetLink.trim());
      }
      return;
    }
    if (classroom?.google_meet_link?.trim()) {
      setMeetLinkPaste(classroom.google_meet_link.trim());
    }
  }, [scheduleOpen, scheduleSectionId, scheduleSectionOptions, classroom?.google_meet_link]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("classroom_sections" as any)
      .select("id, name, google_meet_link")
      .eq("classroom_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const rows =
          (data as Array<{ id: string; name: string; google_meet_link: string | null }> | null) ?? [];
        setScheduleSectionOptions(
          rows.map((r) => ({ id: r.id, name: r.name, googleMeetLink: r.google_meet_link ?? null }))
        );
      });
  }, [id]);

  useEffect(() => {
    if (!id || feedKey === 0) return;
    supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("classroom_id", id)
      .then(({ count }) => setPostCount(count ?? 0));
  }, [id, feedKey]);

  const refetchJoinRequests = useCallback(async () => {
    if (!id || classroom?.teacher_id !== user?.id) return;
    try {
      const headers: HeadersInit = {};
      const currentSession = (await safeGetSession()).session;
      if (currentSession?.access_token)
        headers["Authorization"] = `Bearer ${currentSession.access_token}`;
      const res = await fetch(`/api/classroom/${id}/join-requests`, {
        headers,
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setJoinRequests(Array.isArray(data) ? (data as JoinRequest[]) : []);
      else {
        setJoinRequests([]);
        if (res.status >= 500)
          toast({
            title: "Could not load requests",
            description: (data as { error?: string })?.error ?? "Try Refresh again.",
            variant: "destructive",
          });
      }
    } catch {
      setJoinRequests([]);
      toast({
        title: "Could not load requests",
        description: "Check your connection and try Refresh.",
        variant: "destructive",
      });
    }
  }, [id, classroom?.teacher_id, user?.id, toast]);

  const refetchMembers = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("classroom_members")
      .select("user_id, role, joined_at, section_id, profiles(name, avatar_url)")
      .eq("classroom_id", id);
    if (error) {
      toast({
        title: "Could not load members",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setMembers((data as Member[]) || []);
  }, [id, toast]);

  const handleFeedCountsChange = useCallback((counts: FeedCountsPayload) => {
    setStudentSidebarPostTotal(counts.total);
  }, []);

  useEffect(() => {
    setStudentSidebarPostTotal(null);
  }, [id]);

  const assignMemberTeachingSection = useCallback(
    async (userId: string, sectionId: string | null) => {
      if (!id || !session?.access_token) {
        toast({ title: "Sign in required", variant: "destructive" });
        return;
      }
      setAssigningSectionUserId(userId);
      try {
        const res = await fetch(`/api/classroom/${id}/members/assign-section`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId, sectionId }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast({
            title: "Could not update section",
            description: data.error ?? "Try again.",
            variant: "destructive",
          });
          return;
        }
        await refetchMembers();
        toast({ title: "Teaching section updated" });
      } catch {
        toast({ title: "Network error", variant: "destructive" });
      } finally {
        setAssigningSectionUserId(null);
      }
    },
    [id, session?.access_token, refetchMembers, toast]
  );

  const isOwner = classroom?.teacher_id === user?.id;
  const studentPreview = searchParams.get("view") === "student";
  const showTeacherControls = Boolean(
    isOwner &&
      !studentPreview &&
      ownerTeacherGate.ready &&
      ownerTeacherGate.approved
  );
  const isClassMember = useMemo(
    () => Boolean(user?.id && members.some((m) => m.user_id === user.id)),
    [user?.id, members]
  );
  const isGuestExplorer = useMemo(
    () => Boolean(user?.id && classroom && !isOwner && !isClassMember),
    [user?.id, classroom, isOwner, isClassMember]
  );

  /** Students only — teachers are not listed as classmates. */
  const studentMembers = useMemo(
    () => members.filter((m) => (m.role ?? "").toLowerCase() !== "teacher"),
    [members]
  );

  /** Current viewer's section_id if they are a student member. */
  const currentStudentSectionId = useMemo(() => {
    if (!user?.id || showTeacherControls) return null;
    const me = members.find((m) => m.user_id === user.id);
    if (!me || (me.role ?? "").toLowerCase() === "teacher") return null;
    return me.section_id ?? null;
  }, [user?.id, showTeacherControls, members]);

  /**
   * In student view:
   * - if unassigned: show the full class roster (students only),
   * - if assigned to a section: show only classmates in the same section.
   */
  const studentVisibleMembers = useMemo(() => {
    if (!currentStudentSectionId) return studentMembers;
    return studentMembers.filter((m) => (m.section_id ?? null) === currentStudentSectionId);
  }, [studentMembers, currentStudentSectionId]);

  /** Logged-in viewer's teaching section (not the class subtitle / batch label). */
  const studentSectionDisplay = useMemo(() => {
    if (!user?.id || showTeacherControls) return null;
    const me = members.find((m) => m.user_id === user.id);
    if (!me || (me.role ?? "").toLowerCase() === "teacher") return null;
    if (!me.section_id) return { kind: "unassigned" as const };
    const name = scheduleSectionOptions.find((s) => s.id === me.section_id)?.name;
    return { kind: "section" as const, name: name ?? "Section" };
  }, [user?.id, showTeacherControls, members, scheduleSectionOptions]);

  useEffect(() => {
    if (!showTeacherControls && activeTab === "settings") {
      setActiveTab("home");
    }
  }, [showTeacherControls, activeTab]);

  const upcomingLiveSessions = useMemo(() => {
    return [...liveSessions]
      .filter((s) => getSessionJoinStatus(s.scheduled_at, s.duration_minutes) !== "ended")
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [liveSessions]);

  const hasTeacherSections = scheduleSectionOptions.length > 0;

  const firstClassSessionHasStarted = useMemo(() => {
    const now = Date.now();
    const ordered = [...liveSessions].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
    for (const s of ordered) {
      const st = (s.status ?? "").toString().trim().toLowerCase();
      if (st === "cancelled" || st === "canceled") continue;
      const start = new Date(s.scheduled_at).getTime();
      if (!Number.isFinite(start)) continue;
      return now >= start;
    }
    return false;
  }, [liveSessions]);

  const nextExplorerMeetHref = useMemo(() => {
    const next = upcomingLiveSessions[0] ?? null;
    if (!next) {
      const classMeet = classroom?.google_meet_link?.trim();
      return classMeet ? normalizeMeetLink(classMeet) : "";
    }
    if (next.meet_link?.trim()) return normalizeMeetLink(next.meet_link);
    const sid = next.section_id ?? null;
    if (sid) {
      const sec = scheduleSectionOptions.find((s) => s.id === sid);
      const link = sec?.googleMeetLink?.trim();
      if (link) return normalizeMeetLink(link);
    }
    const classMeet = classroom?.google_meet_link?.trim();
    return classMeet ? normalizeMeetLink(classMeet) : "";
  }, [upcomingLiveSessions, scheduleSectionOptions, classroom?.google_meet_link]);

  const showInvestorMeetCta = hasTeacherSections && !firstClassSessionHasStarted;

  const openLiveMeeting = useCallback(
    async (s: LiveSession) => {
      const href = s.meet_link ? normalizeMeetLink(s.meet_link) : "";
      if (!href) {
        toast({
          title: "No meeting link",
          description: "Ask your teacher to add a Google Meet or Zoom link for this session.",
          variant: "destructive",
        });
        return;
      }
      setJoiningSessionId(s.id);
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch("/api/live/join", {
          method: "POST",
          headers,
          body: JSON.stringify({ sessionId: s.id }),
        });
        const data = (await res.json()) as {
          error?: string;
        };
        if (!res.ok) {
          toast({
            title: "Cannot open meeting yet",
            description: data.error ?? "Try again.",
            variant: "destructive",
          });
          return;
        }
        await refreshProfile();
        window.open(href, "_blank", "noopener,noreferrer");
      } catch {
        toast({ title: "Could not open meeting", variant: "destructive" });
      } finally {
        setJoiningSessionId(null);
      }
    },
    [session?.access_token, refreshProfile, toast]
  );

  const refetchPostsAndLiveForExplorer = useCallback(
    async (useExplorerApi: boolean = false) => {
      if (!id) return;
      if (useExplorerApi) {
        const headers: HeadersInit = {};
        const currentSession = (await safeGetSession()).session;
        if (currentSession?.access_token)
          headers["Authorization"] = `Bearer ${currentSession.access_token}`;
        const res = await fetch(`/api/classroom/${id}/explorer-content`, {
          credentials: "include",
          headers,
        });
        if (!res.ok) {
          setExplorerPosts([]);
          return;
        }
        const data = (await res.json()) as { posts: Post[]; liveSessions: LiveSession[] };
        setLiveSessions(data.liveSessions ?? []);
        setExplorerPosts(data.posts ?? []);
        setPostCount((data.posts ?? []).length);
        setFeedKey((k) => k + 1);
        return;
      }
      setExplorerPosts(null);
      const { data: sessions } = await supabase
        .from("live_sessions")
        .select("id, title, scheduled_at, duration_minutes, meet_link, status")
        .eq("classroom_id", id)
        .order("scheduled_at", { ascending: true });
      setLiveSessions((sessions as LiveSession[]) || []);
      const { count } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("classroom_id", id);
      setPostCount(count ?? 0);
      setFeedKey((k) => k + 1);
    },
    [id]
  );

  useEffect(() => {
    if (!id || !user || !classroom || isOwner) return;
    if (isClassMember) {
      setExplorationAllowed(true);
      setExplorerPosts(null);
      return;
    }
    let cancelled = false;
    const doFetch = async () => {
      const headers: HeadersInit = {};
      const currentSession = (await safeGetSession()).session;
      if (currentSession?.access_token)
        headers["Authorization"] = `Bearer ${currentSession.access_token}`;
      const res = await fetch(`/api/classroom/${id}/exploration-status`, {
        credentials: "include",
        headers,
      });
      const data = (await res.json()) as {
        allowed?: boolean;
        error?: string;
      };
      if (cancelled) return;
      if (!res.ok) {
        setExplorationAllowed(false);
        return;
      }
      setExplorationAllowed(Boolean(data.allowed));
      if (data.allowed) {
        await refetchPostsAndLiveForExplorer(true);
      }
    };
    void doFetch().catch(() => {
      if (!cancelled) setExplorationAllowed(null);
    });
    return () => {
      cancelled = true;
    };
  }, [id, user?.id, classroom?.id, isOwner, isClassMember, refetchPostsAndLiveForExplorer]);

  // Best-effort: ensure temporal section history is consistent for members (RLS depends on it).
  useEffect(() => {
    if (!id || !session?.access_token) return;
    if (!isClassMember || showTeacherControls) return;
    void fetch(`/api/classroom/${id}/ensure-section-history`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { repaired?: boolean };
        if (data.repaired) setFeedKey((k) => k + 1);
      })
      .catch(() => {
        // best-effort
      });
  }, [id, session?.access_token, isClassMember, showTeacherControls]);

  // Retry loading posts/live for explorers via API after a short delay
  useEffect(() => {
    if (!id || isOwner || !isGuestExplorer || explorationAllowed !== true) return;
    const t = setTimeout(() => refetchPostsAndLiveForExplorer(true), 600);
    return () => clearTimeout(t);
  }, [id, isOwner, isGuestExplorer, explorationAllowed, refetchPostsAndLiveForExplorer]);

  useEffect(() => {
    if (!id || !user || isOwner || !isGuestExplorer) return;
    supabase
      .from("classroom_join_requests")
      .select("status")
      .eq("classroom_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setExplorerJoinRequestStatus((data?.status as "pending" | "rejected") ?? "none");
      });
  }, [id, user?.id, isOwner, isGuestExplorer]);

  const handleExplorerRequestJoin = async () => {
    if (!id || !user?.id || !classroom) return;
    setExplorerRequestingJoin(true);
    const { error } = await supabase
      .from("classroom_join_requests")
      .insert({ classroom_id: id, user_id: user.id, status: "pending" });
    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from("classroom_join_requests")
          .select("status")
          .eq("classroom_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing?.status === "rejected") {
          const { error: updateErr } = await supabase
            .from("classroom_join_requests")
            .update({ status: "pending", responded_at: null, responded_by: null })
            .eq("classroom_id", id)
            .eq("user_id", user.id)
            .eq("status", "rejected");
          if (!updateErr) {
            setExplorerJoinRequestStatus("pending");
            toast({
              title: "Re-apply sent!",
              description: "The teacher will review your request.",
            });
          } else toast({ title: "Error", description: updateErr.message, variant: "destructive" });
        } else {
          setExplorerJoinRequestStatus("pending");
          toast({ title: "Request already sent", description: "The teacher will review it." });
        }
      } else toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setExplorerJoinRequestStatus("pending");
      toast({
        title: "Request sent!",
        description: "The teacher will review your request to join.",
      });
    }
    setExplorerRequestingJoin(false);
  };

  useEffect(() => {
    refetchJoinRequests();
  }, [refetchJoinRequests]);

  useEffect(() => {
    if (activeTab === "members") {
      if (isOwner) refetchJoinRequests();
      refetchMembers();
    }
  }, [activeTab, isOwner, refetchJoinRequests, refetchMembers]);

  const handleApproveRequest = async (
    requestId: string,
    userId: string,
    studentName?: string | null
  ) => {
    if (!user?.id || !classroom?.id || !id) return;
    setActingRequestId(requestId);
    const { error: insertErr } = await supabase
      .from("classroom_members")
      .insert({ classroom_id: classroom.id, user_id: userId, role: "student" });
    if (insertErr) {
      toast({ title: "Error", description: insertErr.message, variant: "destructive" });
      setActingRequestId(null);
      return;
    }
    await supabase
      .from("classroom_join_requests")
      .update({ status: "approved", responded_at: new Date().toISOString(), responded_by: user.id })
      .eq("id", requestId);
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    // Show new member immediately, then refetch to stay in sync with DB
    const newMember: Member = {
      user_id: userId,
      role: "student",
      joined_at: new Date().toISOString(),
      section_id: null,
      profiles: { name: studentName ?? "Student", avatar_url: null },
    };
    setMembers((prev) => (prev.some((m) => m.user_id === userId) ? prev : [...prev, newMember]));
    await refetchMembers();
    const { data: sectionsWithSeries } = await supabase
      .from("classroom_sections" as any)
      .select("id")
      .eq("classroom_id", classroom.id)
      .not("google_recurring_event_id", "is", null);
    const hasSectionCalendars = (sectionsWithSeries?.length ?? 0) > 0;
    const googleSeriesLinked = Boolean(
      (classroom as unknown as { google_recurring_event_id?: string | null })?.google_recurring_event_id
    );
    if (!hasSectionCalendars && googleSeriesLinked) {
      try {
        const headers: HeadersInit = {};
        const currentSession = (await safeGetSession()).session;
        if (currentSession?.access_token)
          headers["Authorization"] = `Bearer ${currentSession.access_token}`;
        await fetch(`/api/integrations/google/classrooms/${id}/attendees`, {
          method: "POST",
          headers,
          credentials: "include",
        });
      } catch {
        // best-effort
      }
    }
    toast({ title: "Request approved", description: "Student has been added to the class." });
    setActingRequestId(null);
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!user?.id) return;
    setActingRequestId(requestId);
    await supabase
      .from("classroom_join_requests")
      .update({ status: "rejected", responded_at: new Date().toISOString(), responded_by: user.id })
      .eq("id", requestId);
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    toast({ title: "Request declined" });
    setActingRequestId(null);
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!isOwner || !classroom?.id || userId === user?.id) return;
    if (!confirm(`Remove ${memberName} from this class? They will need to request to join again.`))
      return;
    setRemovingMemberId(userId);
    const { error } = await supabase
      .from("classroom_members")
      .delete()
      .eq("classroom_id", classroom.id)
      .eq("user_id", userId);
    setRemovingMemberId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    toast({
      title: "Member removed",
      description: `${memberName} has been removed from the class.`,
    });
  };

  if (loading)
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="flex items-center justify-center py-20">
            <span className="text-4xl animate-pulse">📚</span>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  if (!classroom)
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="text-center py-20">
            <h2 className="font-display text-2xl">Classroom not found</h2>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );

  return (
    <ProtectedRoute>
      <AppLayout hideTopNav={Boolean(studentPreview && isOwner)}>
        <div className="space-y-6">
          {studentPreview && isOwner ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">
                <span className="font-bold">Student preview</span>
                <span className="text-muted-foreground">
                  {" "}
                  — same tabs and content as enrolled students; site navigation is hidden.
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-xl font-bold">
                  <Link
                    href={`/teacher-portal?section=myClassroom&classroom=${encodeURIComponent(classroom.id)}&portalDetail=settings`}
                  >
                    Back to class settings
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl font-bold"
                  onClick={() => router.replace(`/classroom/${id}`)}
                >
                  Exit preview
                </Button>
              </div>
            </div>
          ) : null}
          {isOwner && !studentPreview && ownerTeacherGate.ready && !ownerTeacherGate.approved ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50">
              <strong>Teacher verification required.</strong> Admin approval is required before you can post,
              schedule sessions, or manage members from this page.{" "}
              <Link
                href="/teacher-portal?section=profile&edit=1"
                className="font-semibold underline underline-offset-2"
              >
                Open Teacher Portal → Profile
              </Link>
            </div>
          ) : null}
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl gradient-primary p-4 text-primary-foreground sm:rounded-3xl sm:p-6 lg:p-8"
          >
            <div className="relative z-10">
              <h1 className="text-xl font-display mb-1 sm:text-2xl lg:text-3xl">{classroom.name}</h1>
              {classroom.subject && (
                <p className="text-primary-foreground/80 font-bold">{classroom.subject}</p>
              )}
              {classroom.section && (
                <span className="inline-block mt-1.5 bg-primary-foreground/20 px-2.5 py-0.5 rounded-full text-xs font-bold sm:mt-2 sm:px-3 sm:py-1 sm:text-sm">
                  {classroom.section}
                </span>
              )}
              {studentSectionDisplay && (
                <span className="inline-block mt-1.5 ml-0 rounded-full border border-emerald-300/50 bg-emerald-950/50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-50 shadow-sm sm:mt-2 sm:px-3 sm:py-1 sm:text-xs">
                  Your section:{" "}
                  {studentSectionDisplay.kind === "unassigned"
                    ? "Unassigned"
                    : studentSectionDisplay.name}
                </span>
              )}
              {showTeacherControls && (
                <div className="mt-3 flex items-center gap-2 sm:mt-4">
                  <span className="text-xs text-primary-foreground/70 sm:text-sm">Join Code:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(classroom.join_code);
                      toast({ title: "Copied!" });
                    }}
                    className="bg-primary-foreground/20 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-primary-foreground/30 transition-colors sm:px-3 sm:text-sm"
                  >
                    <Copy className="w-3.5 h-3.5" /> {classroom.join_code}
                  </button>
                </div>
              )}
              {classroom.google_classroom_id && (
                <div className="mt-2.5 sm:mt-3">
                  <a
                    href={
                      classroom.google_classroom_id.startsWith("http")
                        ? classroom.google_classroom_id
                        : "https://classroom.google.com"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-primary-foreground/20 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-primary-foreground/30 transition-colors text-primary-foreground sm:px-3 sm:py-1.5 sm:text-sm"
                  >
                    Open in Google Classroom
                  </a>
                  {!classroom.google_classroom_id.startsWith("http") && (
                    <span className="ml-2 text-sm text-primary-foreground/80">
                      (Code: {classroom.google_classroom_id})
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-primary-foreground/10 rounded-full blur-sm" />
          </motion.div>

          {/* Tabs */}
          <div className="flex overflow-x-auto gap-1 bg-muted/30 p-1 rounded-2xl">
            {tabs
              .filter((t) => t.id !== "settings" || showTeacherControls)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === t.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="text-sm">{t.emoji}</span> {t.label}
                </button>
              ))}
          </div>

          {/* Explorer banner: interest + optional next-meet link (no countdown UI) */}
          {!isOwner && isGuestExplorer && explorationAllowed === true && (
            <div className="edu-card p-5 rounded-2xl border-primary/30 bg-primary/5 dark:bg-primary/10 text-center space-y-3">
              <p className="font-bold text-foreground">You&apos;re previewing this class.</p>
              <p className="text-sm text-muted-foreground">
                If you want full access, request to join. The teacher can approve you anytime.
              </p>
              {showInvestorMeetCta && upcomingLiveSessions[0] ? (
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const next0 = upcomingLiveSessions[0];
                    return (
                      <>
                        Next session:{" "}
                        <span className="font-semibold text-foreground">
                          {new Date(next0.scheduled_at).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {next0.section_id ? (
                          <span className="ml-2 inline-flex rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-200">
                            Only{" "}
                            {scheduleSectionOptions.find((s) => s.id === next0.section_id)?.name ??
                              "section"}
                          </span>
                        ) : (
                          <span className="ml-2 inline-flex rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-200">
                            Whole class
                          </span>
                        )}
                      </>
                    );
                  })()}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {explorerJoinRequestStatus === "pending" ? (
                  <p className="text-sm text-primary font-medium">
                    Request sent · Pending. You can still explore.
                  </p>
                ) : explorerJoinRequestStatus === "rejected" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={handleExplorerRequestJoin}
                    disabled={explorerRequestingJoin}
                  >
                    Reapply to join
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="rounded-xl"
                    onClick={handleExplorerRequestJoin}
                    disabled={explorerRequestingJoin}
                  >
                    Request to join
                  </Button>
                )}
                {showInvestorMeetCta && nextExplorerMeetHref ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => window.open(nextExplorerMeetHref, "_blank", "noopener,noreferrer")}
                  >
                    Open next Meet
                  </Button>
                ) : null}
              </div>
              {showInvestorMeetCta && !nextExplorerMeetHref ? (
                <p className="text-xs text-muted-foreground">
                  Meet link isn&apos;t available yet — your teacher will add it before the session.
                </p>
              ) : null}
            </div>
          )}

          {/* Tab content */}
          {activeTab === "home" && (isOwner || explorationAllowed !== false) && (
            <div className="space-y-6">
              {upcomingLiveSessions.length > 0 && (
                <div className="edu-card rounded-2xl border border-primary/25 bg-primary/5 p-4 dark:bg-primary/10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                        Upcoming live class
                      </p>
                      <p className="mt-1 font-display text-lg font-bold text-foreground">
                        {upcomingLiveSessions[0].title}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {new Date(upcomingLiveSessions[0].scheduled_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        · {upcomingLiveSessions[0].duration_minutes} min
                      </p>
                      {upcomingLiveSessions.length > 1 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          +{upcomingLiveSessions.length - 1} more scheduled — open Live for the full
                          list.
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      className="rounded-xl edu-btn-primary shrink-0 font-bold"
                      onClick={() => setActiveTab("live")}
                    >
                      View Live tab
                    </Button>
                  </div>
                </div>
              )}
              {/* About this class (larger) + Class Overview (compact) side by side */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4 items-start">
                {/* About this class - takes most space */}
                <div className="edu-card p-4 sm:p-6">
                  <h3 className="font-display text-base text-foreground mb-2.5 sm:text-lg sm:mb-3">About this class</h3>
                  {(classroom.subject || classroom.section) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {classroom.subject && (
                        <span className="edu-chip bg-primary/10 text-primary text-xs">
                          {classroom.subject}
                        </span>
                      )}
                      {classroom.section && (
                        <span className="edu-chip bg-muted text-muted-foreground text-xs">
                          {classroom.section}
                        </span>
                      )}
                    </div>
                  )}
                  {classroom.description?.trim() && (
                    <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">
                      {classroom.description.trim()}
                    </p>
                  )}
                  {(() => {
                    const embedUrl = classroom.intro_video_url
                      ? getEmbedUrl(classroom.intro_video_url)
                      : null;
                    if (embedUrl) {
                      return (
                        <div className="max-w-full">
                          <div className="rounded-xl overflow-hidden aspect-video bg-muted border border-border w-full">
                            <iframe
                              src={embedUrl}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              title="Class intro"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Optional intro — watch to get a quick overview of this class.
                          </p>
                        </div>
                      );
                    }
                    if (classroom.intro_video_url?.trim()) {
                      return (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
                          <p className="font-medium">Invalid or unsupported video URL.</p>
                          {showTeacherControls && (
                            <p className="mt-1 text-xs">
                              Update the link in Settings to a valid YouTube or Vimeo URL.
                            </p>
                          )}
                        </div>
                      );
                    }
                    if (showTeacherControls) {
                      return (
                        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
                          <p className="text-sm text-muted-foreground mb-2">
                            Add an intro video in Settings so students know what this class is
                            about.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => setActiveTab("settings")}
                          >
                            Go to Settings
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                        <p className="text-sm text-muted-foreground">No intro video yet.</p>
                      </div>
                    );
                  })()}
                  {showTeacherControls && (
                    <p className="text-xs text-muted-foreground mt-3 rounded-lg bg-muted/50 p-2">
                      Intro video guidelines: Minimum 3 minutes, record with your own voice so
                      students can understand what this class is about.
                    </p>
                  )}
                </div>
                {/* Class Overview - compact block, natural height */}
                <div className="edu-card p-4 self-start sm:p-6">
                  <h3 className="font-display text-base text-foreground mb-2.5 sm:text-lg sm:mb-3">Class Overview</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div className="bg-muted/30 rounded-xl p-2.5 text-center">
                      <p className="text-xl font-extrabold text-foreground">{studentVisibleMembers.length}</p>
                      <p className="text-muted-foreground text-[10px] font-bold">Members</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-2.5 text-center">
                      <p className="text-xl font-extrabold text-foreground">
                        {showTeacherControls ? postCount : (studentSidebarPostTotal ?? postCount)}
                      </p>
                      <p className="text-muted-foreground text-[10px] font-bold">Posts</p>
                    </div>
                  </div>
                  {/* Rating summary */}
                  {classRating && (
                    <div className="mb-4 flex items-center gap-2 px-1">
                      <StarRatingBadge
                        rating={classRating.avg_rating}
                        count={classRating.review_count}
                      />
                      <button
                        type="button"
                        onClick={() => setActiveTab("reviews")}
                        className="text-[10px] text-primary font-bold hover:underline"
                      >
                        View
                      </button>
                    </div>
                  )}
                  {studentVisibleMembers.length > 0 && (
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                        Recently joined
                      </p>
                      <ul className="space-y-2">
                        {[...studentVisibleMembers]
                          .sort(
                            (a, b) =>
                              new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
                          )
                          .slice(0, 4)
                          .map((m) => (
                            <li key={m.user_id} className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 rounded-full border border-border">
                                <AvatarImage src={m.profiles?.avatar_url ?? undefined} alt="" />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {(m.profiles?.name ?? "?").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-foreground truncate">
                                  {m.profiles?.name ?? "Member"}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  joined{" "}
                                  {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  section:{" "}
                                  {m.section_id
                                    ? scheduleSectionOptions.find((s) => s.id === m.section_id)
                                        ?.name ?? "section"
                                    : "unassigned"}
                                </p>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <h3 className="font-display text-lg text-foreground">Recent Posts</h3>
              <ClassFeed
                classroomId={classroom.id}
                refreshKey={feedKey}
                onSelectPost={setSelectedPost}
                initialPosts={!isOwner && explorerPosts !== null ? explorerPosts : undefined}
                sectionOptions={scheduleSectionOptions}
                viewerIsTeacher={showTeacherControls}
                isEnrolledStudent={Boolean(isClassMember && !showTeacherControls)}
                onFeedCountsChange={
                  !showTeacherControls && isClassMember ? handleFeedCountsChange : undefined
                }
              />
            </div>
          )}

          {activeTab === "posts" && (isOwner || explorationAllowed !== false) && (
            <div className="space-y-4">
              {showTeacherControls && !showComposer && (
                <Button
                  onClick={() => setShowComposer(true)}
                  className="rounded-xl edu-btn-primary font-bold gap-2"
                >
                  <Plus className="w-4 h-4" /> Create Post
                </Button>
              )}
              {showComposer && (
                <PostComposer
                  classroomId={classroom.id}
                  onClose={() => setShowComposer(false)}
                  onPublished={() => {
                    setShowComposer(false);
                    setFeedKey((k) => k + 1);
                  }}
                />
              )}
              <ClassFeed
                classroomId={classroom.id}
                refreshKey={feedKey}
                onSelectPost={setSelectedPost}
                initialPosts={!isOwner && explorerPosts !== null ? explorerPosts : undefined}
                sectionOptions={scheduleSectionOptions}
                viewerIsTeacher={showTeacherControls}
                isEnrolledStudent={Boolean(isClassMember && !showTeacherControls)}
                onFeedCountsChange={
                  !showTeacherControls && isClassMember ? handleFeedCountsChange : undefined
                }
              />
            </div>
          )}

          {activeTab === "live" && (isOwner || explorationAllowed !== false) && (
            <div className="space-y-6">
              {showTeacherControls && (
                <Button
                  onClick={() => setScheduleOpen(true)}
                  className="rounded-xl edu-btn-primary font-bold gap-2"
                >
                  <Calendar className="w-4 h-4" /> Schedule Live Lecture
                </Button>
              )}
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Google Meet or Zoom</p>
                <p className="mt-1">
                  Students see scheduled classes on{" "}
                  <span className="font-semibold text-foreground">Home</span> and here. They can
                  open the meeting during the join window (from 30 minutes before start until the
                  class ends).
                </p>
              </div>
              <div className="edu-card p-6">
                <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
                  <Video className="w-5 h-5" /> Scheduled sessions
                </h3>
                {liveSessions.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No live sessions yet. {showTeacherControls ? "Schedule one above." : ""}
                  </p>
                ) : (
                  (() => {
                    const ended = liveSessions
                      .filter(
                        (s) => getSessionJoinStatus(s.scheduled_at, s.duration_minutes) === "ended"
                      )
                      .sort(
                        (a, b) =>
                          new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
                      );
                    const remaining = liveSessions
                      .filter(
                        (s) => getSessionJoinStatus(s.scheduled_at, s.duration_minutes) !== "ended"
                      )
                      .sort(
                        (a, b) =>
                          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
                      );
                    const sessionList = (list: typeof liveSessions) =>
                      list.map((s) => {
                        const joinStatus = getSessionJoinStatus(s.scheduled_at, s.duration_minutes);
                        const href = s.meet_link ? normalizeMeetLink(s.meet_link) : "";
                        return (
                          <div
                            key={s.id}
                            className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 sm:flex-row sm:items-center sm:gap-4"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-foreground">{s.title}</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                                {new Date(s.scheduled_at).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}{" "}
                                · {s.duration_minutes} min
                              </p>
                              {s.section_id ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Only{" "}
                                  {scheduleSectionOptions.find((sec) => sec.id === s.section_id)?.name ??
                                    "section"}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs text-muted-foreground">Whole class</p>
                              )}
                            </div>
                            <span
                              className={`edu-chip shrink-0 text-xs ${s.status === "scheduled" ? "bg-edu-green/10 text-edu-green" : "bg-muted text-muted-foreground"}`}
                            >
                              {s.status}
                            </span>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              {showTeacherControls && href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-bold text-primary hover:underline"
                                >
                                  Open link
                                </a>
                              ) : null}
                              {!href && joinStatus !== "ended" ? (
                                <span className="text-xs text-amber-700 dark:text-amber-300">
                                  No meeting link — add one when scheduling.
                                </span>
                              ) : null}
                              {href && joinStatus === "upcoming" ? (
                                <span className="text-xs text-muted-foreground">
                                  Join opens 30 min before start.
                                </span>
                              ) : null}
                              {href && joinStatus === "live" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 rounded-xl text-xs edu-btn-primary"
                                  disabled={joiningSessionId === s.id}
                                  onClick={() => void openLiveMeeting(s)}
                                >
                                  {joiningSessionId === s.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  Join meeting
                                </Button>
                              ) : null}
                              {joinStatus === "ended" ? (
                                <span className="text-xs text-muted-foreground">Ended</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      });
                    return (
                      <div className="space-y-6">
                        {ended.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground mb-2">
                              History
                            </p>
                            <div className="space-y-3">{sessionList(ended)}</div>
                          </div>
                        )}
                        {remaining.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-foreground mb-2">
                              {remaining.length} upcoming
                            </p>
                            <div className="space-y-3">{sessionList(remaining)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>

              <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogContent className="rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle>Schedule Live Lecture</DialogTitle>
                    <DialogDescription className="sr-only">
                      Set the title, date, meeting link, and duration for your live lecture.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <Label className="text-sm font-extrabold">Notify (optional)</Label>
                      <select
                        value={scheduleSectionId ?? "__class__"}
                        onChange={(e) => {
                          const v = e.target.value;
                          setScheduleSectionId(v === "__class__" ? null : v);
                        }}
                        className="mt-1 h-10 w-full appearance-none rounded-xl border border-border bg-background px-3 pr-10 text-sm outline-none focus:border-edu-green"
                      >
                        <option value="__class__">Whole class (all students)</option>
                        {scheduleSectionOptions.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            Only {sec.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Whole class = everyone gets it. Only section = only that section gets it.
                        {scheduleSectionId
                          ? scheduleSectionOptions.find((s) => s.id === scheduleSectionId)
                              ?.googleMeetLink
                            ? " Meet link will auto-fill from this section’s Google Calendar."
                            : " This section has no Google Meet link yet — create/sync its Google Calendar schedule first."
                          : classroom?.google_meet_link
                            ? " Meet link will auto-fill from the class Google Calendar."
                            : " No class Meet link saved — paste one or sync Google Calendar first."}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-extrabold">Title</Label>
                      <Input
                        value={scheduleTitle}
                        onChange={(e) => setScheduleTitle(e.target.value)}
                        placeholder="e.g. Chapter 5 Revision"
                        className="rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-extrabold">Date & time</Label>
                      <Input
                        type="datetime-local"
                        value={scheduleAt}
                        onChange={(e) => setScheduleAt(e.target.value)}
                        className="rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-extrabold">Duration (minutes)</Label>
                      <Input
                        type="number"
                        min={15}
                        max={240}
                        value={scheduleDuration}
                        onChange={(e) => setScheduleDuration(parseInt(e.target.value, 10) || 60)}
                        className="rounded-xl mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-extrabold">Meeting link *</Label>
                      <Input
                        placeholder="https://meet.google.com/... or Zoom link"
                        value={meetLinkPaste}
                        onChange={(e) => setMeetLinkPaste(e.target.value)}
                        className="rounded-xl mt-1"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Students see this on Home and Live during the join window.
                      </p>
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setScheduleOpen(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="rounded-xl edu-btn-primary"
                      disabled={
                        !scheduleTitle.trim() ||
                        !scheduleAt ||
                        !meetLinkPaste.trim() ||
                        savingSchedule
                      }
                      onClick={async () => {
                        if (
                          !user?.id ||
                          !classroom?.id ||
                          !scheduleTitle.trim() ||
                          !scheduleAt ||
                          !meetLinkPaste.trim()
                        )
                          return;
                        setSavingSchedule(true);
                        const scheduledAt = new Date(scheduleAt).toISOString();
                        const meetLink = normalizeMeetLink(meetLinkPaste);
                        try {
                          const headers: HeadersInit = {};
                          if (session?.access_token)
                            headers["Authorization"] = `Bearer ${session.access_token}`;
                          const res = await fetch("/api/live/schedule", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...headers },
                            body: JSON.stringify({
                              classroom_id: classroom.id,
                              section_id: scheduleSectionId,
                              title: scheduleTitle.trim(),
                              scheduled_at: scheduledAt,
                              duration_minutes: scheduleDuration,
                              meet_link: meetLink,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            toast({
                              title: "Could not schedule",
                              description: (data as { error?: string })?.error ?? "Try again.",
                              variant: "destructive",
                            });
                            setSavingSchedule(false);
                            return;
                          }
                          const created = (
                            data as {
                              session?: {
                                id: string;
                                title: string;
                                scheduled_at: string;
                                duration_minutes: number;
                                meet_link: string | null;
                                status: string;
                                section_id?: string | null;
                              };
                            }
                          ).session;
                          if (created) {
                            setLiveSessions((prev) => [
                              ...prev,
                              {
                                id: created.id,
                                title: created.title,
                                scheduled_at: created.scheduled_at,
                                duration_minutes: created.duration_minutes,
                                meet_link: created.meet_link,
                                status: created.status,
                                section_id: created.section_id ?? null,
                              },
                            ]);
                          }
                          setScheduleTitle("");
                          setScheduleAt("");
                          setScheduleDuration(60);
                          setMeetLinkPaste("");
                          setScheduleSectionId(null);
                          setScheduleOpen(false);
                          await refreshProfile();
                          // Trigger Google Calendar attendee emails (section-scoped if chosen).
                          // This does not create a one-off Google event; it ensures the recurring series has the right attendees.
                          try {
                            const notifyRes = await fetch(
                              `/api/integrations/google/classrooms/${classroom.id}/attendees`,
                              {
                                method: "POST",
                                credentials: "include",
                                headers: { "Content-Type": "application/json", ...headers },
                                body: JSON.stringify({ sectionId: scheduleSectionId }),
                              }
                            );
                            const notifyJson = (await notifyRes.json().catch(() => ({}))) as
                              | {
                                  ok?: boolean;
                                  addedStudentEmails?: number;
                                  studentsWithoutEmail?: number;
                                  error?: string;
                                }
                              | undefined;
                            if (!notifyRes.ok) {
                              toast({
                                title: "Scheduled, but no email notification sent",
                                description:
                                  notifyJson?.error?.trim() ||
                                  "Could not send Google Calendar notifications.",
                                variant: "destructive",
                              });
                            }
                          } catch {
                            // Ignore network errors; session scheduling succeeded.
                          }
                          toast({
                            title: "Session scheduled",
                            description: "Students will see it on Home and in the Live tab.",
                          });
                        } finally {
                          setSavingSchedule(false);
                        }
                      }}
                    >
                      {savingSchedule ? "Saving..." : "Schedule"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {activeTab === "members" && (isOwner || explorationAllowed !== false) && (
            <div className="space-y-6">
              {showTeacherControls && (
                <div className="edu-card p-6 border-primary/20">
                  <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                    <h3 className="font-display text-lg text-foreground flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-primary" /> Join requests (
                      {joinRequests.length})
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5"
                      onClick={refetchJoinRequests}
                    >
                      <Loader2 className="w-3.5 h-3.5" /> Refresh
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Approve or reject students who requested to join this class. Pending requests
                    appear below.
                  </p>
                  {joinRequests.length === 0 ? (
                    <div className="text-muted-foreground text-sm py-4 px-4 rounded-xl bg-muted/30 space-y-1 text-center">
                      <p className="font-medium">No pending requests right now.</p>
                      <p className="text-xs">
                        If a student says they sent a request, ask them to click &quot;Request to
                        join&quot; again (or refresh their page), then click{" "}
                        <strong>Refresh</strong> above.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {joinRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex flex-col gap-3 p-3 bg-muted/40 rounded-xl sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary sm:w-10 sm:h-10">
                              {(req.profiles?.name || "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground sm:text-base">
                                {req.profiles?.name || "Student"}
                              </p>
                              <p className="text-[11px] text-muted-foreground sm:text-xs">Requested to join</p>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleApproveRequest(req.id, req.user_id, req.profiles?.name)
                              }
                              disabled={!!actingRequestId}
                              className="rounded-xl gap-1.5 bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90"
                            >
                              {actingRequestId === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectRequest(req.id)}
                              disabled={!!actingRequestId}
                              className="rounded-xl gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 font-bold"
                            >
                              {actingRequestId === req.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showTeacherControls && (
                <div className="edu-card p-6">
                  <h3 className="font-display text-lg text-foreground mb-4">Invite Students</h3>
                  <InviteStudents classroomId={classroom.id} joinCode={classroom.join_code} />
                </div>
              )}
              <div className="edu-card p-4 sm:p-6">
                <div className="flex items-center gap-2.5 mb-4 sm:mb-5">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-display text-foreground sm:text-xl">
                      Members ({studentVisibleMembers.length})
                    </h2>
                    {!showTeacherControls && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Showing:{" "}
                        {currentStudentSectionId
                          ? scheduleSectionOptions.find((s) => s.id === currentStudentSectionId)
                              ?.name ?? "your section"
                          : "whole class (unassigned)"}
                      </p>
                    )}
                  </div>
                </div>
                {studentVisibleMembers.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No members yet. Share the join code to invite students!
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {studentVisibleMembers.map((m) => (
                      <div
                        key={m.user_id}
                        className="flex flex-wrap items-center gap-2.5 bg-muted/40 rounded-xl p-2.5 sm:flex-nowrap sm:gap-3 sm:p-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary sm:w-9 sm:h-9 sm:text-sm">
                          {(m.profiles?.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-foreground">
                            {m.profiles?.name || "Unknown"}
                          </p>
                          {showTeacherControls && m.role === "student" ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <select
                                className="max-w-[min(100%,220px)] rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground"
                                value={m.section_id ?? ""}
                                disabled={assigningSectionUserId === m.user_id}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  void assignMemberTeachingSection(
                                    m.user_id,
                                    v === "" ? null : v
                                  );
                                }}
                                aria-label={`Teaching section for ${m.profiles?.name ?? "student"}`}
                              >
                                <option value="">No teaching section</option>
                                {scheduleSectionOptions.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              {assigningSectionUserId === m.user_id ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {m.section_id
                                ? scheduleSectionOptions.find((s) => s.id === m.section_id)?.name ??
                                  "Teaching section"
                                : "No teaching section"}
                            </p>
                          )}
                        </div>
                        <span
                          className={`edu-chip text-[11px] shrink-0 sm:text-xs ${m.role === "teacher" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          {m.role}
                        </span>
                        {showTeacherControls && m.role === "student" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleRemoveMember(m.user_id, m.profiles?.name || "Student")
                            }
                            disabled={!!removingMemberId}
                            className="shrink-0 rounded-xl gap-1 text-[11px] text-destructive border-destructive/50 hover:bg-destructive/10 sm:gap-1.5 sm:text-xs"
                          >
                            {removingMemberId === m.user_id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">Remove</span>
                            <span className="sm:hidden">Del</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reviews tab */}
          {activeTab === "reviews" && (
            <ClassroomReviews classroomId={classroom.id} isOwner={showTeacherControls} />
          )}

          {activeTab === "settings" && showTeacherControls && (
            <div className="edu-card p-6 max-w-xl">
              <h3 className="font-display text-lg text-foreground mb-4">Classroom Settings</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-extrabold">Intro / demo video URL</Label>
                  <Input
                    type="url"
                    placeholder="https://www.youtube.com/... or https://vimeo.com/..."
                    value={settingsIntroVideoUrl}
                    onChange={(e) => setSettingsIntroVideoUrl(e.target.value)}
                    className="rounded-xl mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    YouTube or Vimeo link. Students will see this on the class Home. Minimum 3
                    minutes, use your own voice to explain what this class is about.
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-extrabold">
                    Short description (what this class is about)
                  </Label>
                  <textarea
                    placeholder="e.g. We cover NCERT Physics Class 11 mechanics and waves..."
                    value={settingsDescription}
                    onChange={(e) => setSettingsDescription(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                  />
                </div>
                <Button
                  className="rounded-xl edu-btn-primary"
                  disabled={savingSettings}
                  onClick={async () => {
                    if (!id || !classroom) return;
                    setSavingSettings(true);
                    const { error } = await supabase
                      .from("classrooms")
                      .update({
                        intro_video_url: settingsIntroVideoUrl.trim() || null,
                        description: settingsDescription.trim() || null,
                      })
                      .eq("id", id);
                    setSavingSettings(false);
                    if (error) {
                      toast({ title: "Error", description: error.message, variant: "destructive" });
                      return;
                    }
                    setClassroom((prev) =>
                      prev
                        ? {
                            ...prev,
                            intro_video_url: settingsIntroVideoUrl.trim() || null,
                            description: settingsDescription.trim() || null,
                          }
                        : null
                    );
                    toast({ title: "Settings saved" });
                  }}
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Manage members from the Members tab.
              </p>
            </div>
          )}

          <PostDetailModal
            post={selectedPost}
            open={!!selectedPost}
            onClose={() => {
              setSelectedPost(null);
              // Clear deep-link param so back/refresh doesn't reopen the modal.
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete("post");
                router.replace(
                  url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "")
                );
              } catch {
                // ignore
              }
            }}
            canEdit={!!showTeacherControls}
            onUpdated={() => setFeedKey((k) => k + 1)}
            classroomId={id}
          />

          {/* Daily review popup for enrolled students */}
          {!isOwner && !isGuestExplorer && classroom && (
            <ReviewPopup classroomId={classroom.id} classroomName={classroom.name} />
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
};

export default ClassroomDetail;
