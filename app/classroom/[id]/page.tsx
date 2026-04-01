"use client";

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Copy, Users, BookOpen, Settings, Home, MessageSquare, Video, Plus, Calendar, Clock, UserPlus, Check, X, Loader2, UserMinus, Star } from 'lucide-react';
import ClassroomReviews from '@/components/ClassroomReviews';
import ReviewPopup from '@/components/ReviewPopup';
import { StarRatingBadge } from '@/components/StarRating';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import ClassFeed, { type Post } from '@/components/ClassFeed';
import PostComposer from '@/components/PostComposer';
import PostDetailModal from '@/components/PostDetailModal';
import InviteStudents from '@/components/InviteStudents';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

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
}

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
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
}

type Tab = 'home' | 'posts' | 'live' | 'members' | 'reviews' | 'settings';

/** Session is joinable from 30 min before start until end of class (+ 15 min buffer). No joining earlier to avoid storage/bandwidth. */
function getSessionJoinStatus(scheduled_at: string, duration_minutes: number): 'live' | 'upcoming' | 'ended' {
  const start = new Date(scheduled_at).getTime();
  const joinFrom = start - 30 * 60 * 1000;
  const joinUntil = start + (duration_minutes + 15) * 60 * 1000;
  const now = Date.now();
  if (now < joinFrom) return 'upcoming';
  if (now > joinUntil) return 'ended';
  return 'live';
}

const tabs: { id: Tab; label: string; icon: typeof Home; emoji: string }[] = [
  { id: 'home', label: 'Home', icon: Home, emoji: '🏠' },
  { id: 'posts', label: 'Posts', icon: MessageSquare, emoji: '📝' },
  { id: 'live', label: 'Live', icon: Video, emoji: '🎥' },
  { id: 'members', label: 'Members', icon: Users, emoji: '👥' },
  { id: 'reviews', label: 'Reviews', icon: Star, emoji: '⭐' },
  { id: 'settings', label: 'Settings', icon: Settings, emoji: '⚙️' },
];

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { JitsiEmbed, isJitsiLink } from "@/components/JitsiEmbed";
import { getJitsiMeetLink, getJitsiRoomNameForMeeting, isJitsiAppIdSet } from "@/lib/jitsi";
import { getEmbedUrl } from "@/lib/videoEmbed";

const JitsiClass = dynamic(() => import('@/components/JitsiClass'), { ssr: false });

const ClassroomDetail = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string | undefined;
  const { user, profile, session, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [classroom, setClassroom] = useState<ClassroomData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showComposer, setShowComposer] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleDuration, setScheduleDuration] = useState(60);
  const [createMeetLink, setCreateMeetLink] = useState(true);
  const [meetLinkPaste, setMeetLinkPaste] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [embedSession, setEmbedSession] = useState<LiveSession | null>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [settingsIntroVideoUrl, setSettingsIntroVideoUrl] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [postCount, setPostCount] = useState<number>(0);
  const [explorationExpiresAt, setExplorationExpiresAt] = useState<number | null>(null);
  const [explorationAllowed, setExplorationAllowed] = useState<boolean | null>(null);
  const [explorerLiveExpiresAt, setExplorerLiveExpiresAt] = useState<number | null>(null);
  const [explorerLiveSessionId, setExplorerLiveSessionId] = useState<string | null>(null);
  const [explorerJoinRequestStatus, setExplorerJoinRequestStatus] = useState<'none' | 'pending' | 'rejected' | null>(null);
  const [explorerRequestingJoin, setExplorerRequestingJoin] = useState(false);
  const [explorationSecondsLeft, setExplorationSecondsLeft] = useState<number | null>(null);
  const [explorerPosts, setExplorerPosts] = useState<Post[] | null>(null);
  const [classRating, setClassRating] = useState<{ avg_rating: number; review_count: number } | null>(null);
  const [showExplorerReview, setShowExplorerReview] = useState(false);

  useEffect(() => {
    if (activeTab === 'settings' && classroom) {
      setSettingsIntroVideoUrl(classroom.intro_video_url ?? '');
      setSettingsDescription(classroom.description ?? '');
    }
  }, [activeTab, classroom?.id, classroom?.intro_video_url, classroom?.description]);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const { data: c } = await supabase.from('classrooms').select('*').eq('id', id).maybeSingle();
      setClassroom(c as ClassroomData | null);

      const { data: m } = await supabase.from('classroom_members').select('user_id, role, joined_at, profiles(name, avatar_url)').eq('classroom_id', id);
      setMembers((m as Member[]) || []);

      const { data: sessions } = await supabase.from('live_sessions').select('id, title, scheduled_at, duration_minutes, meet_link, status').eq('classroom_id', id).order('scheduled_at', { ascending: true });
      setLiveSessions((sessions as LiveSession[]) || []);

      const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('classroom_id', id);
      setPostCount(count ?? 0);

      // Fetch rating summary
      const { data: reviews } = await (supabase as any).from('classroom_reviews').select('rating').eq('classroom_id', id);
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
    if (!id || feedKey === 0) return;
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('classroom_id', id).then(({ count }) => setPostCount(count ?? 0));
  }, [id, feedKey]);

  const refetchJoinRequests = useCallback(async () => {
    if (!id || classroom?.teacher_id !== user?.id) return;
    try {
      const headers: HeadersInit = {};
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.access_token) headers['Authorization'] = `Bearer ${currentSession.access_token}`;
      const res = await fetch(`/api/classroom/${id}/join-requests`, { headers, credentials: 'include' });
      const data = await res.json();
      if (res.ok) setJoinRequests(Array.isArray(data) ? (data as JoinRequest[]) : []);
      else {
        setJoinRequests([]);
        if (res.status >= 500) toast({ title: 'Could not load requests', description: (data as { error?: string })?.error ?? 'Try Refresh again.', variant: 'destructive' });
      }
    } catch {
      setJoinRequests([]);
      toast({ title: 'Could not load requests', description: 'Check your connection and try Refresh.', variant: 'destructive' });
    }
  }, [id, classroom?.teacher_id, user?.id, toast]);

  const refetchMembers = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from('classroom_members').select('user_id, role, joined_at, profiles(name, avatar_url)').eq('classroom_id', id);
    if (error) {
      toast({ title: 'Could not load members', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers((data as Member[]) || []);
  }, [id, toast]);

  const isOwner = classroom?.teacher_id === user?.id;
  const isExplorer = explorationExpiresAt !== null && explorationExpiresAt !== undefined;

  const refetchPostsAndLiveForExplorer = useCallback(async (useExplorerApi: boolean = false) => {
    if (!id) return;
    if (useExplorerApi) {
      const headers: HeadersInit = {};
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.access_token) headers['Authorization'] = `Bearer ${currentSession.access_token}`;
      const res = await fetch(`/api/classroom/${id}/explorer-content`, { credentials: 'include', headers });
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
    const { data: sessions } = await supabase.from('live_sessions').select('id, title, scheduled_at, duration_minutes, meet_link, status').eq('classroom_id', id).order('scheduled_at', { ascending: true });
    setLiveSessions((sessions as LiveSession[]) || []);
    const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }).eq('classroom_id', id);
    setPostCount(count ?? 0);
    setFeedKey((k) => k + 1);
  }, [id]);

  useEffect(() => {
    if (!id || !user || !classroom || isOwner) return;
    const doFetch = async () => {
      const headers: HeadersInit = {};
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.access_token) headers['Authorization'] = `Bearer ${currentSession.access_token}`;
      const res = await fetch(`/api/classroom/${id}/exploration-status`, { credentials: 'include', headers });
      const data = (await res.json()) as { allowed?: boolean; expiresAt?: number | null; startedAt?: number };
      if (data.expiresAt == null) {
        setExplorationExpiresAt(null);
        setExplorationAllowed(true);
        return;
      }
      setExplorationExpiresAt(data.expiresAt);
      setExplorationAllowed(!!data.allowed);
      if (data.allowed) {
        await refetchPostsAndLiveForExplorer(true);
      }
    };
    doFetch().catch(() => {
      setExplorationAllowed(null);
      setExplorationExpiresAt(null);
    });
  }, [id, user?.id, classroom?.id, isOwner, refetchPostsAndLiveForExplorer]);

  // Retry loading posts/live for explorers via API after a short delay
  useEffect(() => {
    if (!id || isOwner || explorationAllowed !== true || explorationExpiresAt == null) return;
    const t = setTimeout(() => refetchPostsAndLiveForExplorer(true), 600);
    return () => clearTimeout(t);
  }, [id, isOwner, explorationAllowed, explorationExpiresAt, refetchPostsAndLiveForExplorer]);

  // Live countdown for explorers: only runs while page is visible; stops when user leaves (tab hidden or navigates away)
  useEffect(() => {
    if (explorationExpiresAt == null || explorationAllowed !== true) {
      setExplorationSecondsLeft(null);
      return;
    }
    const update = () => {
      if (document.visibilityState === 'hidden') return;
      const remaining = Math.max(0, Math.ceil((explorationExpiresAt - Date.now()) / 1000));
      setExplorationSecondsLeft(remaining);
      if (remaining <= 0) setExplorationAllowed(false);
    };
    update();
    const interval = setInterval(update, 1000);
    const onVisible = () => update();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      setExplorationSecondsLeft(null);
    };
  }, [explorationExpiresAt, explorationAllowed]);

  useEffect(() => {
    if (explorationExpiresAt == null) return;
    const check = () => {
      if (Date.now() >= explorationExpiresAt) {
        setExplorationAllowed(false);
        setEmbedSession(null);
        setActiveRoom(null);
        setExplorerLiveExpiresAt(null);
        setExplorerLiveSessionId(null);
        toast({ title: 'Exploration time ended. Request to join for full access.' });
      }
    };
    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [explorationExpiresAt, toast]);

  useEffect(() => {
    if (!id || !user || isOwner || explorationExpiresAt == null) return;
    supabase.from('classroom_join_requests').select('status').eq('classroom_id', id).eq('user_id', user.id).maybeSingle().then(({ data }) => {
      setExplorerJoinRequestStatus((data?.status as 'pending' | 'rejected') ?? 'none');
    });
  }, [id, user?.id, isOwner, explorationExpiresAt]);

  const handleExplorerRequestJoin = async () => {
    if (!id || !user?.id || !classroom) return;
    setExplorerRequestingJoin(true);
    const { error } = await supabase.from('classroom_join_requests').insert({ classroom_id: id, user_id: user.id, status: 'pending' });
    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabase.from('classroom_join_requests').select('status').eq('classroom_id', id).eq('user_id', user.id).maybeSingle();
        if (existing?.status === 'rejected') {
          const { error: updateErr } = await supabase.from('classroom_join_requests').update({ status: 'pending', responded_at: null, responded_by: null }).eq('classroom_id', id).eq('user_id', user.id).eq('status', 'rejected');
          if (!updateErr) {
            setExplorerJoinRequestStatus('pending');
            toast({ title: 'Re-apply sent!', description: 'The teacher will review your request.' });
          } else toast({ title: 'Error', description: updateErr.message, variant: 'destructive' });
        } else {
          setExplorerJoinRequestStatus('pending');
          toast({ title: 'Request already sent', description: 'The teacher will review it.' });
        }
      } else toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setExplorerJoinRequestStatus('pending');
      toast({ title: 'Request sent!', description: 'The teacher will review your request to join.' });
    }
    setExplorerRequestingJoin(false);
  };

  useEffect(() => {
    if (explorerLiveExpiresAt == null) return;
    const remaining = explorerLiveExpiresAt - Date.now();
    if (remaining <= 0) {
      setEmbedSession(null);
      setActiveRoom(null);
      setExplorerLiveExpiresAt(null);
      setExplorerLiveSessionId(null);
      toast({ title: 'Your 8-minute live preview has ended. Request to join the class for full access.' });
      return;
    }
    const t = setTimeout(() => {
      setEmbedSession(null);
      setActiveRoom(null);
      setExplorerLiveExpiresAt(null);
      setExplorerLiveSessionId(null);
      toast({ title: 'Your 8-minute live preview has ended. Request to join the class for full access.' });
    }, remaining);
    return () => clearTimeout(t);
  }, [explorerLiveExpiresAt, toast]);

  useEffect(() => {
    refetchJoinRequests();
  }, [refetchJoinRequests]);

  useEffect(() => {
    if (activeTab === 'members') {
      if (isOwner) refetchJoinRequests();
      refetchMembers();
    }
  }, [activeTab, isOwner, refetchJoinRequests, refetchMembers]);

  const handleApproveRequest = async (requestId: string, userId: string, studentName?: string | null) => {
    if (!user?.id || !classroom?.id || !id) return;
    setActingRequestId(requestId);
    const { error: insertErr } = await supabase.from('classroom_members').insert({ classroom_id: classroom.id, user_id: userId, role: 'student' });
    if (insertErr) {
      toast({ title: 'Error', description: insertErr.message, variant: 'destructive' });
      setActingRequestId(null);
      return;
    }
    await supabase.from('classroom_join_requests').update({ status: 'approved', responded_at: new Date().toISOString(), responded_by: user.id }).eq('id', requestId);
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    // Show new member immediately, then refetch to stay in sync with DB
    const newMember: Member = { user_id: userId, role: 'student', joined_at: new Date().toISOString(), profiles: { name: studentName ?? 'Student', avatar_url: null } };
    setMembers((prev) => (prev.some((m) => m.user_id === userId) ? prev : [...prev, newMember]));
    await refetchMembers();
    toast({ title: 'Request approved', description: 'Student has been added to the class.' });
    setActingRequestId(null);
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!user?.id) return;
    setActingRequestId(requestId);
    await supabase.from('classroom_join_requests').update({ status: 'rejected', responded_at: new Date().toISOString(), responded_by: user.id }).eq('id', requestId);
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    toast({ title: 'Request declined' });
    setActingRequestId(null);
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!isOwner || !classroom?.id || userId === user?.id) return;
    if (!confirm(`Remove ${memberName} from this class? They will need to request to join again.`)) return;
    setRemovingMemberId(userId);
    const { error } = await supabase.from('classroom_members').delete().eq('classroom_id', classroom.id).eq('user_id', userId);
    setRemovingMemberId(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    toast({ title: 'Member removed', description: `${memberName} has been removed from the class.` });
  };

  if (loading) return <ProtectedRoute><AppLayout><div className="flex items-center justify-center py-20"><span className="text-4xl animate-pulse">📚</span></div></AppLayout></ProtectedRoute>;
  if (!classroom) return <ProtectedRoute><AppLayout><div className="text-center py-20"><h2 className="font-display text-2xl">Classroom not found</h2></div></AppLayout></ProtectedRoute>;

  return (
    <ProtectedRoute>
      <AppLayout>
        {activeRoom && (
          <JitsiClass
            roomName={activeRoom}
            userName={profile?.name ?? 'Student'}
            onLeave={() => { setActiveRoom(null); setExplorerLiveSessionId(null); }}
            sessionId={explorerLiveSessionId ?? undefined}
          />
        )}
        <div className="space-y-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl gradient-primary p-8 text-primary-foreground">
            <div className="relative z-10">
              <h1 className="text-3xl font-display mb-1">{classroom.name}</h1>
              {classroom.subject && <p className="text-primary-foreground/80 font-bold">{classroom.subject}</p>}
              {classroom.section && <span className="inline-block mt-2 bg-primary-foreground/20 px-3 py-1 rounded-full text-sm font-bold">{classroom.section}</span>}
              {isOwner && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm text-primary-foreground/70">Join Code:</span>
                  <button onClick={() => { navigator.clipboard.writeText(classroom.join_code); toast({ title: 'Copied!' }); }}
                    className="bg-primary-foreground/20 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-primary-foreground/30 transition-colors">
                    <Copy className="w-3.5 h-3.5" /> {classroom.join_code}
                  </button>
                </div>
              )}
              {classroom.google_classroom_id && (
                <div className="mt-3">
                  <a href={classroom.google_classroom_id.startsWith('http') ? classroom.google_classroom_id : 'https://classroom.google.com'} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-primary-foreground/20 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-primary-foreground/30 transition-colors text-primary-foreground">
                    Open in Google Classroom
                  </a>
                  {!classroom.google_classroom_id.startsWith('http') && (
                    <span className="ml-2 text-sm text-primary-foreground/80">(Code: {classroom.google_classroom_id})</span>
                  )}
                </div>
              )}
            </div>
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-primary-foreground/10 rounded-full blur-sm" />
          </motion.div>

          {/* Tabs */}
          <div className="flex overflow-x-auto gap-1 bg-muted/30 p-1 rounded-2xl">
            {tabs.filter(t => t.id !== 'settings' || isOwner).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <span className="text-sm">{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Explorer banner: within 10-min exploration, show time left + request to join */}
          {!isOwner && explorationAllowed === true && explorationExpiresAt != null && (
            <div className="edu-card p-5 rounded-2xl border-primary/30 bg-primary/5 dark:bg-primary/10 text-center space-y-3">
              <p className="font-bold text-foreground">
                You&apos;re exploring this class.{' '}
                {explorationSecondsLeft != null ? (
                  <span className="font-mono tabular-nums">
                    {Math.floor(explorationSecondsLeft / 60)}:{String(explorationSecondsLeft % 60).padStart(2, '0')} left
                  </span>
                ) : (
                  <>About {Math.max(0, Math.ceil((explorationExpiresAt - Date.now()) / 60000))} min left.</>
                )}
              </p>
              <p className="text-sm text-muted-foreground">After 10 minutes, entry is closed. Request to join now to get full access.</p>
              {explorerJoinRequestStatus === 'pending' ? (
                <p className="text-sm text-primary font-medium">Request sent · Pending. You can still explore.</p>
              ) : explorerJoinRequestStatus === 'rejected' ? (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={handleExplorerRequestJoin} disabled={explorerRequestingJoin}>
                  Reapply to join
                </Button>
              ) : (
                <Button size="sm" className="rounded-xl" onClick={handleExplorerRequestJoin} disabled={explorerRequestingJoin}>
                  Request to join
                </Button>
              )}
            </div>
          )}

          {/* Exploration ended: non-member 10-min preview is over */}
          {!isOwner && explorationAllowed === false && (
            <div className="edu-card p-6 rounded-2xl border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 space-y-4">
              <div className="text-center">
                <p className="font-bold text-foreground">Exploration time ended.</p>
                <p className="text-sm text-muted-foreground">Request to join to get full access to this class.</p>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {explorerJoinRequestStatus === 'pending' ? (
                    <p className="text-sm text-primary font-medium">Request sent · Pending. The teacher will review it.</p>
                  ) : (
                    <Button className="rounded-xl" onClick={handleExplorerRequestJoin} disabled={explorerRequestingJoin}>
                      {explorerJoinRequestStatus === 'rejected' ? 'Reapply to join' : 'Request to join'}
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-xl" onClick={() => router.push('/classrooms')}>
                    Back to Classrooms
                  </Button>
                </div>
              </div>
              {/* Explorer review prompt */}
              <div className="border-t border-amber-200/60 dark:border-amber-800/60 pt-5 mt-2">
                <AnimatePresence mode="wait">
                  {!showExplorerReview ? (
                    <motion.div
                      key="prompt-btn"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex justify-center"
                    >
                      <Button
                        variant="outline"
                        onClick={() => setShowExplorerReview(true)}
                        className="rounded-xl font-extrabold text-amber-700 dark:text-amber-300 border-amber-300 shadow-sm hover:bg-amber-100 dark:hover:bg-amber-900/50 hover:border-amber-400 gap-2 px-6"
                      >
                        <motion.div animate={{ rotate: [0, 15, -10, 0] }} transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.5 }}>
                          <Star className="w-4 h-4 fill-amber-500 text-amber-500 drop-shadow-sm" />
                        </motion.div>
                        Rate this class
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="prompt-form"
                      initial={{ opacity: 0, height: 0, y: 10 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: 10 }}
                      className="bg-background/80 backdrop-blur-sm p-5 rounded-2xl border border-border shadow-sm overflow-hidden"
                    >
                      <ClassroomReviews
                        classroomId={id!}
                        isOwner={false}
                        compact
                        isExplorer
                        onReviewSubmitted={() => {
                          setTimeout(() => setShowExplorerReview(false), 2000);
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Tab content */}
          {activeTab === 'home' && (isOwner || explorationAllowed !== false) && (
            <div className="space-y-6">
              {/* About this class (larger) + Class Overview (compact) side by side */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-4 items-start">
                {/* About this class - takes most space */}
                <div className="edu-card p-6">
                  <h3 className="font-display text-lg text-foreground mb-3">About this class</h3>
                  {(classroom.subject || classroom.section) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {classroom.subject && <span className="edu-chip bg-primary/10 text-primary text-xs">{classroom.subject}</span>}
                      {classroom.section && <span className="edu-chip bg-muted text-muted-foreground text-xs">{classroom.section}</span>}
                    </div>
                  )}
                  {classroom.description?.trim() && (
                    <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{classroom.description.trim()}</p>
                  )}
                  {(() => {
                    const embedUrl = classroom.intro_video_url ? getEmbedUrl(classroom.intro_video_url) : null;
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
                          <p className="text-xs text-muted-foreground mt-1.5">Optional intro — watch to get a quick overview of this class.</p>
                        </div>
                      );
                    }
                    if (classroom.intro_video_url?.trim()) {
                      return (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
                          <p className="font-medium">Invalid or unsupported video URL.</p>
                          {isOwner && <p className="mt-1 text-xs">Update the link in Settings to a valid YouTube or Vimeo URL.</p>}
                        </div>
                      );
                    }
                    if (isOwner) {
                      return (
                        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
                          <p className="text-sm text-muted-foreground mb-2">Add an intro video in Settings so students know what this class is about.</p>
                          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setActiveTab('settings')}>Go to Settings</Button>
                        </div>
                      );
                    }
                    return (
                      <div className="rounded-xl border border-border bg-muted/20 p-4 text-center">
                        <p className="text-sm text-muted-foreground">No intro video yet.</p>
                      </div>
                    );
                  })()}
                  {isOwner && (
                    <p className="text-xs text-muted-foreground mt-3 rounded-lg bg-muted/50 p-2">
                      Intro video guidelines: Minimum 3 minutes, record with your own voice so students can understand what this class is about.
                    </p>
                  )}
                </div>
                {/* Class Overview - compact block, natural height */}
                <div className="edu-card p-6 self-start">
                  <h3 className="font-display text-lg text-foreground mb-3">Class Overview</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div className="bg-muted/30 rounded-xl p-2.5 text-center">
                      <p className="text-xl font-extrabold text-foreground">{members.length}</p>
                      <p className="text-muted-foreground text-[10px] font-bold">Members</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-2.5 text-center">
                      <p className="text-xl font-extrabold text-foreground">{postCount}</p>
                      <p className="text-muted-foreground text-[10px] font-bold">Posts</p>
                    </div>
                  </div>
                  {/* Rating summary */}
                  {classRating && (
                    <div className="mb-4 flex items-center gap-2 px-1">
                      <StarRatingBadge rating={classRating.avg_rating} count={classRating.review_count} />
                      <button type="button" onClick={() => setActiveTab('reviews')} className="text-[10px] text-primary font-bold hover:underline">View</button>
                    </div>
                  )}
                  {members.length > 0 && (
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-2">Recently joined</p>
                      <ul className="space-y-2">
                        {[...members]
                          .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())
                          .slice(0, 4)
                          .map((m) => (
                            <li key={m.user_id} className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 rounded-full border border-border">
                                <AvatarImage src={m.profiles?.avatar_url ?? undefined} alt="" />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {(m.profiles?.name ?? '?').slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-foreground truncate">{m.profiles?.name ?? 'Member'}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  joined {formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })}
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
              />
            </div>
          )}

          {activeTab === 'posts' && (isOwner || explorationAllowed !== false) && (
            <div className="space-y-4">
              {isOwner && !showComposer && (
                <Button onClick={() => setShowComposer(true)} className="rounded-xl edu-btn-primary font-bold gap-2">
                  <Plus className="w-4 h-4" /> Create Post
                </Button>
              )}
              {showComposer && (
                <PostComposer classroomId={classroom.id} onClose={() => setShowComposer(false)} onPublished={() => { setShowComposer(false); setFeedKey(k => k + 1); }} />
              )}
              <ClassFeed
                classroomId={classroom.id}
                refreshKey={feedKey}
                onSelectPost={setSelectedPost}
                initialPosts={!isOwner && explorerPosts !== null ? explorerPosts : undefined}
              />
            </div>
          )}

          {activeTab === 'live' && (isOwner || explorationAllowed !== false) && (
            <div className="space-y-6">
              {isOwner && (
                <Button onClick={() => setScheduleOpen(true)} className="rounded-xl edu-btn-primary font-bold gap-2">
                  <Calendar className="w-4 h-4" /> Schedule Live Lecture
                </Button>
              )}
              {!isJitsiAppIdSet() && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-medium">Using free Jitsi (meet.jit.si):</p>
                  <p className="mt-1 text-muted-foreground dark:text-amber-200/80">The first person to join must click &quot;Log-in&quot; on the Jitsi screen and sign in with Google or GitHub once to start the meeting. After that, students can join without logging in.</p>
                </div>
              )}
              {isJitsiAppIdSet() && (
                <div className="rounded-xl border border-edu-green/30 bg-edu-green/5 dark:bg-edu-green/10 p-3 text-sm text-foreground">
                  <p className="font-medium">8x8 JaaS video</p>
                  <p className="mt-1 text-muted-foreground">Students can join before the teacher. No Jitsi login required.</p>
                </div>
              )}
              <div className="edu-card p-6">
                <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
                  <Video className="w-5 h-5" /> Scheduled sessions
                </h3>
                {liveSessions.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No live sessions yet. {isOwner ? 'Schedule one above.' : ''}</p>
                ) : (() => {
                  const ended = liveSessions.filter((s) => getSessionJoinStatus(s.scheduled_at, s.duration_minutes) === 'ended')
                    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
                  const remaining = liveSessions.filter((s) => getSessionJoinStatus(s.scheduled_at, s.duration_minutes) !== 'ended')
                    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                  const sessionList = (list: typeof liveSessions) => list.map((s) => (
                    <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 bg-muted/40 rounded-xl">
                      <div className="flex-1">
                        <p className="font-bold text-foreground">{s.title}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(s.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {s.duration_minutes} min
                        </p>
                      </div>
                      <span className={`edu-chip text-xs shrink-0 ${s.status === 'scheduled' ? 'bg-edu-green/10 text-edu-green' : 'bg-muted text-muted-foreground'}`}>
                        {s.status}
                      </span>
                      {s.meet_link && (
                        <div className="flex items-center gap-2 shrink-0 flex-wrap items-center">
                          {isJitsiLink(s.meet_link) ? (() => {
                            const joinStatus = getSessionJoinStatus(s.scheduled_at, s.duration_minutes);
                            const canJoin = joinStatus === 'live' && !activeRoom && !joiningSessionId;
                            const isJoining = joiningSessionId === s.id;
                            return (
                              <>
                                {joinStatus === 'upcoming' && (
                                  <span className="text-xs text-muted-foreground">Starts {new Date(s.scheduled_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} (join from 30 min before)</span>
                                )}
                                {joinStatus === 'ended' && (
                                  <span className="text-xs text-muted-foreground">Ended</span>
                                )}
                                <Button
                                  size="sm"
                                  className="rounded-xl text-xs h-8 edu-btn-primary"
                                  disabled={!canJoin}
                                  onClick={async () => {
                                    setJoiningSessionId(s.id);
                                    try {
                                      const headers: HeadersInit = {};
                                      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                                      const res = await fetch('/api/live/join', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', ...headers },
                                        body: JSON.stringify({ sessionId: s.id }),
                                      });
                                      const data = await res.json();
                                      if (!res.ok) {
                                        toast({ title: 'Could not join', description: (data as { error?: string })?.error ?? 'Try again.', variant: 'destructive' });
                                        return;
                                      }
                                      const payload = data as { roomName?: string; maxLiveMinutes?: number; explorerJoinedAt?: number };
                                      const roomName = payload.roomName ?? getJitsiRoomNameForMeeting(s.meet_link!);
                                      if (typeof payload.maxLiveMinutes === 'number' && typeof payload.explorerJoinedAt === 'number') {
                                        setExplorerLiveExpiresAt(payload.explorerJoinedAt + payload.maxLiveMinutes * 60 * 1000);
                                        setExplorerLiveSessionId(s.id);
                                      }
                                      await refreshProfile();
                                      setActiveRoom(roomName);
                                    } finally {
                                      setJoiningSessionId(null);
                                    }
                                  }}
                                >
                                  {isJoining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Join Live Class (free)
                                </Button>
                              </>
                            );
                          })() : (
                            <a href={s.meet_link} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-primary hover:underline">Join Meet</a>
                          )}
                          {isJitsiLink(s.meet_link) && getSessionJoinStatus(s.scheduled_at, s.duration_minutes) === 'live' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl text-xs h-8"
                              disabled={!!joiningSessionId}
                              onClick={async () => {
                                setJoiningSessionId(s.id);
                                try {
                                  const headers: HeadersInit = {};
                                  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                                  const res = await fetch('/api/live/join', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', ...headers },
                                    body: JSON.stringify({ sessionId: s.id }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) {
                                    toast({ title: 'Could not join', description: (data as { error?: string })?.error ?? 'Try again.', variant: 'destructive' });
                                    return;
                                  }
                                  const payload = data as { maxLiveMinutes?: number; explorerJoinedAt?: number };
                                  if (typeof payload.maxLiveMinutes === 'number' && typeof payload.explorerJoinedAt === 'number') {
                                    setExplorerLiveExpiresAt(payload.explorerJoinedAt + payload.maxLiveMinutes * 60 * 1000);
                                    setExplorerLiveSessionId(s.id);
                                  }
                                  await refreshProfile();
                                  setEmbedSession(s);
                                } finally {
                                  setJoiningSessionId(null);
                                }
                              }}
                            >
                              {joiningSessionId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Join in app (free)
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ));
                  return (
                    <div className="space-y-6">
                      {ended.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground mb-2">History</p>
                          <div className="space-y-3">{sessionList(ended)}</div>
                        </div>
                      )}
                      {remaining.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-foreground mb-2">{remaining.length} remaining</p>
                          <div className="space-y-3">{sessionList(remaining)}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogContent className="rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle>Schedule Live Lecture</DialogTitle>
                    <DialogDescription className="sr-only">Set the title, date, and options for your live lecture.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <Label className="text-sm font-extrabold">Title</Label>
                      <Input value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="e.g. Chapter 5 Revision" className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm font-extrabold">Date & time</Label>
                      <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm font-extrabold">Duration (minutes)</Label>
                      <Input type="number" min={15} max={240} value={scheduleDuration} onChange={(e) => setScheduleDuration(parseInt(e.target.value, 10) || 60)} className="rounded-xl mt-1" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-extrabold">Create video meeting link</Label>
                      <Switch checked={createMeetLink} onCheckedChange={setCreateMeetLink} />
                    </div>
                    {createMeetLink && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {isJitsiAppIdSet()
                            ? "An 8x8 JaaS meeting link will be created. The room opens at the scheduled time—students can join then; you can join when you're ready (even after start). No login required."
                            : "A Jitsi meeting link will be created automatically. On meet.jit.si, the first person to join must sign in once (Google/GitHub) to start the meeting."}
                        </p>
                        <div>
                          <Label className="text-sm font-extrabold">Or paste a different meeting link (optional)</Label>
                          <Input placeholder="Leave empty to use Jitsi above; or paste Zoom, Meet, etc." value={meetLinkPaste} onChange={(e) => setMeetLinkPaste(e.target.value)} className="rounded-xl mt-1" />
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setScheduleOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button
                      className="rounded-xl edu-btn-primary"
                      disabled={!scheduleTitle.trim() || !scheduleAt || savingSchedule}
                      onClick={async () => {
                        if (!user?.id || !classroom?.id || !scheduleTitle.trim() || !scheduleAt) return;
                        setSavingSchedule(true);
                        const scheduledAt = new Date(scheduleAt).toISOString();
                        const secretRoomId = !meetLinkPaste.trim()
                          ? `RDM-${classroom.id}-${crypto.randomUUID().replace(/-/g, '')}`
                          : null;
                        const meetLink = createMeetLink
                          ? (meetLinkPaste.trim() || (secretRoomId ? getJitsiMeetLink(secretRoomId) : null))
                          : null;
                        try {
                          const headers: HeadersInit = {};
                          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
                          const res = await fetch('/api/live/schedule', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...headers },
                            body: JSON.stringify({
                              classroom_id: classroom.id,
                              title: scheduleTitle.trim(),
                              scheduled_at: scheduledAt,
                              duration_minutes: scheduleDuration,
                              meet_link: meetLink ?? undefined,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            toast({ title: 'Could not schedule', description: (data as { error?: string })?.error ?? 'Try again.', variant: 'destructive' });
                            setSavingSchedule(false);
                            return;
                          }
                          const created = (data as { session?: { id: string; title: string; scheduled_at: string; duration_minutes: number; meet_link: string | null; status: string } }).session;
                          if (created) {
                            setLiveSessions((prev) => [...prev, { id: created.id, title: created.title, scheduled_at: created.scheduled_at, duration_minutes: created.duration_minutes, meet_link: created.meet_link, status: created.status }]);
                          }
                          setScheduleTitle('');
                          setScheduleAt('');
                          setScheduleDuration(60);
                          setMeetLinkPaste('');
                          setScheduleOpen(false);
                          await refreshProfile();
                          toast({ title: 'Session scheduled' });
                        } finally {
                          setSavingSchedule(false);
                        }
                      }}
                    >
                      {savingSchedule ? 'Saving...' : 'Schedule'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={!!embedSession} onOpenChange={(open) => !open && (setEmbedSession(null), setExplorerLiveSessionId(null))}>
                <DialogContent className="rounded-2xl max-w-5xl w-[95vw] h-[85vh] flex flex-col p-4">
                  <DialogHeader>
                    <DialogTitle>{embedSession?.title ?? 'Live'}</DialogTitle>
                    <DialogDescription className="sr-only">Video meeting in this window.</DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 min-h-0 rounded-xl overflow-hidden">
                    {embedSession?.meet_link && (
                      <JitsiEmbed
                        meetLink={embedSession.meet_link}
                        displayName={profile?.name ?? 'Participant'}
                        sessionId={embedSession.id}
                      />
                    )}
                  </div>
                  <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => { setEmbedSession(null); setExplorerLiveSessionId(null); }} className="rounded-xl">Close</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {activeTab === "members" && (isOwner || explorationAllowed !== false) && (
            <div className="space-y-6">
              {isOwner && (
                <div className="edu-card p-6 border-primary/20">
                  <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                    <h3 className="font-display text-lg text-foreground flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-primary" /> Join requests ({joinRequests.length})
                    </h3>
                    <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={refetchJoinRequests}>
                      <Loader2 className="w-3.5 h-3.5" /> Refresh
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">Approve or reject students who requested to join this class. Pending requests appear below.</p>
                  {joinRequests.length === 0 ? (
                    <div className="text-muted-foreground text-sm py-4 px-4 rounded-xl bg-muted/30 space-y-1 text-center">
                      <p className="font-medium">No pending requests right now.</p>
                      <p className="text-xs">If a student says they sent a request, ask them to click &quot;Request to join&quot; again (or refresh their page), then click <strong>Refresh</strong> above.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {joinRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between gap-4 p-4 bg-muted/40 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {(req.profiles?.name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{req.profiles?.name || 'Student'}</p>
                              <p className="text-xs text-muted-foreground">Requested to join</p>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => handleApproveRequest(req.id, req.user_id, req.profiles?.name)}
                              disabled={!!actingRequestId}
                              className="rounded-xl gap-1.5 bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90"
                            >
                              {actingRequestId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectRequest(req.id)}
                              disabled={!!actingRequestId}
                              className="rounded-xl gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 font-bold"
                            >
                              {actingRequestId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isOwner && (
                <div className="edu-card p-6">
                  <h3 className="font-display text-lg text-foreground mb-4">Invite Students</h3>
                  <InviteStudents classroomId={classroom.id} joinCode={classroom.join_code} />
                </div>
              )}
              <div className="edu-card p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-display text-foreground">Members ({members.length})</h2>
                </div>
                {members.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No members yet. Share the join code to invite students!</p>
                ) : (
                  <div className="grid gap-2">
                    {members.map(m => (
                      <div key={m.user_id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {(m.profiles?.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-foreground">{m.profiles?.name || 'Unknown'}</p>
                        </div>
                        <span className={`edu-chip text-xs shrink-0 ${m.role === 'teacher' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {m.role}
                        </span>
                        {isOwner && m.role === 'student' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveMember(m.user_id, m.profiles?.name || 'Student')}
                            disabled={!!removingMemberId}
                            className="shrink-0 rounded-xl gap-1.5 text-destructive border-destructive/50 hover:bg-destructive/10"
                          >
                            {removingMemberId === m.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                            Remove
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
          {activeTab === 'reviews' && (
            <ClassroomReviews classroomId={classroom.id} isOwner={isOwner} />
          )}

          {activeTab === 'settings' && isOwner && (
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
                  <p className="text-xs text-muted-foreground mt-1">YouTube or Vimeo link. Students will see this on the class Home. Minimum 3 minutes, use your own voice to explain what this class is about.</p>
                </div>
                <div>
                  <Label className="text-sm font-extrabold">Short description (what this class is about)</Label>
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
                      .from('classrooms')
                      .update({
                        intro_video_url: settingsIntroVideoUrl.trim() || null,
                        description: settingsDescription.trim() || null,
                      })
                      .eq('id', id);
                    setSavingSettings(false);
                    if (error) {
                      toast({ title: 'Error', description: error.message, variant: 'destructive' });
                      return;
                    }
                    setClassroom((prev) => prev ? { ...prev, intro_video_url: settingsIntroVideoUrl.trim() || null, description: settingsDescription.trim() || null } : null);
                    toast({ title: 'Settings saved' });
                  }}
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Manage members from the Members tab.</p>
            </div>
          )}

          <PostDetailModal
            post={selectedPost}
            open={!!selectedPost}
            onClose={() => setSelectedPost(null)}
            canEdit={!!isOwner}
            onUpdated={() => setFeedKey((k) => k + 1)}
          />

          {/* Daily review popup for enrolled students */}
          {!isOwner && !isExplorer && classroom && (
            <ReviewPopup classroomId={classroom.id} classroomName={classroom.name} />
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default ClassroomDetail;
