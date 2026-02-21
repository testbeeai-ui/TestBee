"use client";

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Users, Copy, BookOpen, Link2, School, UserPlus, Loader2, RotateCw, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GoogleConnectChecklist from '@/components/GoogleConnectChecklist';
import { StarRatingBadge } from '@/components/StarRating';

interface Classroom {
  id: string;
  name: string;
  section: string | null;
  subject: string | null;
  description: string | null;
  join_code: string;
  teacher_id: string;
  created_at: string;
  type: string;
}

interface ExploreClassroom {
  id: string;
  name: string;
  subject: string | null;
  section: string | null;
  description: string | null;
  type: string;
  teacher_id: string;
  teacher_name?: string | null;
  teacher_visibility?: string | null;
  avg_rating?: number;
  review_count?: number;
}

import { ProtectedRoute } from "@/components/ProtectedRoute";

const EXPLORATION_MINUTES = 10;

function ExploreClassesSection({
  exploreClassrooms,
  exploreLoading,
  myRequestMap,
  myMemberClassroomIds,
  explorationEndedClassroomIds,
  requestingId,
  withdrawingId,
  onRequestJoin,
  onWithdrawRequest,
  onOpenClass,
  onRefreshStatus,
  emptyTitle,
  emptySubtitle,
}: {
  exploreClassrooms: ExploreClassroom[];
  exploreLoading: boolean;
  myRequestMap: Record<string, string>;
  myMemberClassroomIds: Set<string>;
  explorationEndedClassroomIds: Set<string>;
  requestingId: string | null;
  withdrawingId?: string | null;
  onRequestJoin: (id: string) => void;
  onWithdrawRequest?: (classroomId: string) => void;
  onOpenClass: (id: string) => void;
  onRefreshStatus?: () => void;
  emptyTitle?: string;
  emptySubtitle?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <School className="w-5 h-5 text-primary" />
            {emptyTitle ? 'Explore classes' : 'Explore more classes'}
          </h2>
          {onRefreshStatus && exploreClassrooms.length > 0 && (
            <button
              type="button"
              onClick={onRefreshStatus}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <RotateCw className="w-3.5 h-3.5" /> Refresh status
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {emptySubtitle ?? "Browse classes from teachers. Request to join — you'll be in once the teacher approves."}
        </p>
      </div>
      {exploreLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : exploreClassrooms.length === 0 ? (
        <div className="text-center py-12 edu-card p-8">
          <School className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="font-display text-lg text-foreground mb-1">{emptyTitle ?? 'No classes to explore yet'}</h3>
          <p className="text-sm text-muted-foreground">
            {emptySubtitle ?? "Teachers with public profiles will show their classes here. Check back later or join with a code from your teacher."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 mb-4">
            <p className="text-sm font-bold text-primary">You can explore any class for 10 minutes.</p>
            <p className="text-xs text-muted-foreground mt-1">After 10 minutes, entry is closed. Request to join is available inside the class while you explore.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {exploreClassrooms.map((c) => {
              const isMember = myMemberClassroomIds.has(c.id);
              const requestStatus = myRequestMap[c.id];
              const isPending = requestStatus === 'pending';
              const explorationEnded = explorationEndedClassroomIds.has(c.id);
              return (
                <motion.div
                  key={c.id}
                  layout
                  className="edu-card p-5 rounded-2xl border border-border hover:border-primary/30 hover:shadow-md transition-all flex flex-col min-h-[200px]"
                >
                  <div className="flex-1 min-h-0 flex flex-col">
                    <h3 className="font-extrabold text-foreground text-base line-clamp-2">{c.name}</h3>
                    {c.subject && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{c.subject}</p>}
                    {c.teacher_name && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">by {c.teacher_name}</p>}
                    <div className="mt-1.5">
                      <StarRatingBadge rating={c.avg_rating ?? 0} count={c.review_count ?? 0} />
                    </div>
                    {c.section && <span className="edu-chip bg-muted text-muted-foreground text-xs mt-2 inline-block w-fit">{c.section}</span>}
                  </div>
                  <div className="shrink-0 mt-4 pt-3 border-t border-border/50">
                    {isMember ? (
                      <Button onClick={() => onOpenClass(c.id)} size="sm" className="w-full rounded-xl font-bold gap-2">
                        Open class
                      </Button>
                    ) : explorationEnded ? (
                      <>
                        <Button
                          onClick={() => onRequestJoin(c.id)}
                          size="sm"
                          className="w-full rounded-xl font-bold gap-2 edu-btn-primary"
                          disabled={isPending || requestingId === c.id}
                        >
                          {requestingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {requestStatus === 'rejected' ? 'Reapply to join' : 'Request to join class'}
                        </Button>
                        {isPending ? (
                          <p className="text-xs text-center text-muted-foreground mt-2">Request sent · Pending.</p>
                        ) : requestStatus === 'rejected' ? (
                          <p className="text-xs text-center text-muted-foreground mt-2">Your previous request was declined. You can reapply above.</p>
                        ) : (
                          <p className="text-xs text-center text-muted-foreground mt-2">Exploration time ended. Request to join for full access.</p>
                        )}
                      </>
                    ) : (
                      <>
                        <Button onClick={() => onOpenClass(c.id)} size="sm" className="w-full rounded-xl font-bold gap-2 edu-btn-primary">
                          Explore class
                        </Button>
                        {isPending ? (
                          <p className="text-xs text-center text-muted-foreground mt-2">Request sent · Pending. You can still explore.</p>
                        ) : requestStatus === 'rejected' ? (
                          <p className="text-xs text-center text-muted-foreground mt-2">Reapply to join from inside the class.</p>
                        ) : (
                          <p className="text-xs text-center text-muted-foreground mt-2">Request to join from inside the class.</p>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const Classrooms = () => {
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [step, setStep] = useState<'type' | 'google_checklist' | 'google_link' | 'form'>('type');
  const [classroomType, setClassroomType] = useState<'esm_only' | 'google_linked'>('esm_only');
  const [newName, setNewName] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newSection, setNewSection] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [googleClassroomLink, setGoogleClassroomLink] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [exploreClassrooms, setExploreClassrooms] = useState<ExploreClassroom[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [myRequestMap, setMyRequestMap] = useState<Record<string, string>>({});
  const [explorationEndedClassroomIds, setExplorationEndedClassroomIds] = useState<Set<string>>(new Set());
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const isTeacher = profile?.role === 'teacher';

  const fetchClassrooms = async () => {
    if (!user) return;
    setLoading(true);
    if (isTeacher) {
      const { data } = await supabase.from('classrooms').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });
      setClassrooms((data as Classroom[]) || []);
    } else {
      const { data: memberships } = await supabase.from('classroom_members').select('classroom_id').eq('user_id', user.id);
      if (memberships && memberships.length > 0) {
        const ids = memberships.map(m => m.classroom_id);
        const { data } = await supabase.from('classrooms').select('*').in('id', ids).order('created_at', { ascending: false });
        setClassrooms((data as Classroom[]) || []);
      } else {
        setClassrooms([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchClassrooms(); }, [user, profile]);

  useEffect(() => {
    if (isTeacher || !user?.id) return;
    let cancelled = false;
    setExploreLoading(true);
    (async () => {
      const { data: allClassrooms } = await supabase.from('classrooms').select('id, name, subject, section, description, type, teacher_id');
      if (cancelled) return;
      const list = allClassrooms || [];
      if (list.length === 0) {
        setExploreClassrooms([]);
        setMyRequestMap({});
        setExploreLoading(false);
        return;
      }
      const teacherIds = [...new Set(list.map((c: { teacher_id: string }) => c.teacher_id))];
      const { data: teacherProfiles } = await supabase.from('profiles').select('id, name, visibility').in('id', teacherIds);
      const profileMap = new Map((teacherProfiles || []).map((p: { id: string; name: string | null; visibility: string }) => [p.id, p]));
      const withTeacher: ExploreClassroom[] = list
        .map((c: { id: string; name: string; subject: string | null; section: string | null; description: string | null; type: string; teacher_id: string }) => {
          const p = profileMap.get(c.teacher_id);
          return { ...c, teacher_name: p?.name ?? null, teacher_visibility: p?.visibility ?? null };
        })
        .filter((c: ExploreClassroom) => c.teacher_visibility !== 'invite_only');
      if (cancelled) return;
      setExploreClassrooms(withTeacher);

      // Fetch review ratings for explore cards
      const classroomIds = withTeacher.map((c: ExploreClassroom) => c.id);
      if (classroomIds.length > 0) {
        const { data: reviewData } = await supabase
          .from('classroom_reviews' as any)
          .select('classroom_id, rating')
          .in('classroom_id', classroomIds);
        if (!cancelled && reviewData) {
          const ratingMap = new Map<string, { sum: number; count: number }>();
          (reviewData as unknown as { classroom_id: string; rating: number }[]).forEach((r) => {
            const existing = ratingMap.get(r.classroom_id) || { sum: 0, count: 0 };
            existing.sum += r.rating;
            existing.count += 1;
            ratingMap.set(r.classroom_id, existing);
          });
          setExploreClassrooms((prev) =>
            prev.map((c) => {
              const stats = ratingMap.get(c.id);
              if (stats) {
                return { ...c, avg_rating: Math.round((stats.sum / stats.count) * 10) / 10, review_count: stats.count };
              }
              return c;
            })
          );
        }
      }

      const { data: requests } = await supabase.from('classroom_join_requests').select('classroom_id, status').eq('user_id', user.id);
      if (cancelled) return;
      const map: Record<string, string> = {};
      (requests || []).forEach((r: { classroom_id: string; status: string }) => { map[r.classroom_id] = r.status; });
      setMyRequestMap(map);

      const cutoff = Date.now() - EXPLORATION_MINUTES * 60 * 1000;
      const { data: explorations } = await supabase.from('class_exploration_sessions').select('classroom_id, started_at').eq('user_id', user.id);
      if (cancelled) return;
      const ended = new Set<string>();
      (explorations || []).forEach((e: { classroom_id: string; started_at: string }) => {
        if (new Date(e.started_at).getTime() < cutoff) ended.add(e.classroom_id);
      });
      setExplorationEndedClassroomIds(ended);
      setExploreLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, isTeacher]);

  const refetchMyRequestMap = useCallback(async () => {
    if (!user?.id) return;
    const { data: requests } = await supabase.from('classroom_join_requests').select('classroom_id, status').eq('user_id', user.id);
    const map: Record<string, string> = {};
    (requests || []).forEach((r: { classroom_id: string; status: string }) => { map[r.classroom_id] = r.status; });
    setMyRequestMap(map);
  }, [user?.id]);

  const refetchExplorationEnded = useCallback(async () => {
    if (!user?.id) return;
    const cutoff = Date.now() - EXPLORATION_MINUTES * 60 * 1000;
    const { data: explorations } = await supabase.from('class_exploration_sessions').select('classroom_id, started_at').eq('user_id', user.id);
    const ended = new Set<string>();
    (explorations || []).forEach((e: { classroom_id: string; started_at: string }) => {
      if (new Date(e.started_at).getTime() < cutoff) ended.add(e.classroom_id);
    });
    setExplorationEndedClassroomIds(ended);
  }, [user?.id]);

  // Refetch which classes have exploration ended whenever user lands on Classrooms (e.g. back from class page)
  useEffect(() => {
    if (pathname === '/classrooms' && user?.id && !isTeacher) {
      refetchExplorationEnded();
    }
  }, [pathname, user?.id, isTeacher, refetchExplorationEnded]);

  // Also refetch when page becomes visible (handles full reload or tab switch so exploration-ended state is fresh)
  useEffect(() => {
    if (!user?.id || isTeacher) return;
    const onVisible = () => refetchExplorationEnded();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user?.id, isTeacher, refetchExplorationEnded]);

  const handleRequestJoin = async (classroomId: string) => {
    if (!user?.id) return;
    setRequestingId(classroomId);
    const { error } = await supabase.from('classroom_join_requests').insert({ classroom_id: classroomId, user_id: user.id, status: 'pending' });
    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabase.from('classroom_join_requests').select('status').eq('classroom_id', classroomId).eq('user_id', user.id).maybeSingle();
        if (existing?.status === 'rejected') {
          const { error: updateErr } = await supabase.from('classroom_join_requests').update({ status: 'pending', responded_at: null, responded_by: null }).eq('classroom_id', classroomId).eq('user_id', user.id).eq('status', 'rejected');
          if (!updateErr) {
            await refetchMyRequestMap();
            toast({ title: 'Re-apply sent!', description: 'Your request has been sent again. The teacher will review it.' });
          } else {
            toast({ title: 'Error', description: updateErr.message, variant: 'destructive' });
          }
        } else {
          await refetchMyRequestMap();
          toast({ title: 'Your request has been sent', description: 'Status: Pending. The teacher will review it.' });
        }
      } else {
        toast({ title: 'Request failed', description: error.message, variant: 'destructive' });
      }
      setRequestingId(null);
      return;
    }
    await refetchMyRequestMap();
    toast({ title: 'Request sent!', description: 'The teacher will review your request to join.' });
    setRequestingId(null);
  };

  const handleWithdrawRequest = async (classroomId: string) => {
    if (!user?.id) return;
    setWithdrawingId(classroomId);
    const { error } = await supabase.from('classroom_join_requests').delete().eq('classroom_id', classroomId).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Could not cancel request', description: error.message, variant: 'destructive' });
    } else {
      await refetchMyRequestMap();
      toast({ title: 'Request cancelled', description: "You can request to join again anytime." });
    }
    setWithdrawingId(null);
  };

  const createClassroom = async () => {
    if (!newName.trim() || !user) return;
    const { error } = await supabase.from('classrooms').insert({
      teacher_id: user.id,
      name: newName.trim(),
      subject: newSubject.trim() || null,
      section: newSection.trim() || null,
      description: newDescription.trim() || null,
      type: classroomType,
      google_classroom_id: googleClassroomLink.trim() || null,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    const { data: newClass } = await supabase.from('classrooms').select('id').eq('teacher_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (newClass) {
      await supabase.from('classroom_members').insert({ classroom_id: newClass.id, user_id: user.id, role: 'teacher' });
    }

    resetDialog();
    fetchClassrooms();
    toast({ title: 'Classroom created! 🎉' });
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setStep('type');
    setNewName(''); setNewSubject(''); setNewSection(''); setNewDescription('');
    setGoogleClassroomLink('');
    setClassroomType('esm_only');
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !user) return;
    const { data: classroom } = await supabase.from('classrooms').select('id').eq('join_code', joinCode.trim()).maybeSingle();
    if (!classroom) { toast({ title: 'Invalid code', description: 'No classroom found with that code.', variant: 'destructive' }); return; }

    const { error } = await supabase.from('classroom_members').insert({ classroom_id: classroom.id, user_id: user.id, role: 'student' });
    if (error) {
      if (error.code === '23505') toast({ title: 'Already joined!' });
      else toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setJoinDialogOpen(false); setJoinCode('');
    fetchClassrooms();
    toast({ title: 'Joined classroom! 🎉' });
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="edu-page-title">{isTeacher ? 'My Classrooms' : 'Classrooms'}</h1>
              <p className="edu-page-desc">{isTeacher ? 'Manage your classes and students' : 'Your enrolled classes'}</p>
              {isTeacher && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your classes appear in Explore for students {profile?.visibility === 'invite_only' ? 'only when your profile is Public — set it in ' : '— to hide them, set '}
                  <button type="button" onClick={() => router.push('/profile')} className="text-primary font-bold underline hover:no-underline">Profile</button>
                  {profile?.visibility === 'invite_only' ? '.' : ' to Invite-only.'}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {!isTeacher && (
                <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-xl font-bold">Join Class</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader><DialogTitle className="font-display">Join a Classroom</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                      <Input placeholder="Enter 8-character join code" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="rounded-xl h-12 text-center text-lg tracking-widest font-bold" maxLength={8} />
                      <Button onClick={handleJoin} className="w-full rounded-xl edu-btn-primary h-12 font-extrabold">Join 🚀</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {isTeacher && (
                <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetDialog(); else setDialogOpen(true); }}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl edu-btn-primary font-bold gap-2"><Plus className="w-4 h-4" /> New Classroom</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl max-w-lg">
                    <DialogHeader><DialogTitle className="font-display">
                      {step === 'type' ? 'Choose Classroom Type' : step === 'google_checklist' ? 'Google Setup' : step === 'google_link' ? 'Link Google Classroom' : 'Create Classroom'}
                    </DialogTitle></DialogHeader>

                    {step === 'type' && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <button onClick={() => { setClassroomType('google_linked'); setStep('google_checklist'); }}
                          className="bg-muted/30 rounded-2xl p-5 text-center border-2 border-border/50 hover:border-primary/40 hover:shadow-md transition-all">
                          <span className="text-3xl block mb-2">🔗</span>
                          <h3 className="font-display text-sm text-foreground">Link with Google</h3>
                          <p className="text-xs text-muted-foreground mt-1">Recommended</p>
                        </button>
                        <button onClick={() => { setClassroomType('esm_only'); setStep('form'); }}
                          className="bg-muted/30 rounded-2xl p-5 text-center border-2 border-border/50 hover:border-primary/40 hover:shadow-md transition-all">
                          <span className="text-3xl block mb-2">🎯</span>
                          <h3 className="font-display text-sm text-foreground">ESM-only</h3>
                          <p className="text-xs text-muted-foreground mt-1">No Google needed</p>
                        </button>
                      </div>
                    )}

                    {step === 'google_checklist' && (
                      <div className="mt-2">
                        <GoogleConnectChecklist
                          onContinue={() => setStep('google_link')}
                          onSkip={() => { setClassroomType('esm_only'); setStep('form'); }}
                        />
                      </div>
                    )}

                    {step === 'google_link' && (
                      <div className="mt-2 space-y-4">
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                          <p className="text-sm font-bold text-foreground mb-1">🔗 Google Classroom API</p>
                          <p className="text-xs text-muted-foreground">Google API integration requires credentials setup in your Supabase project. For now, we'll create an ESM classroom marked for Google linking.</p>
                        </div>
                        <Button onClick={() => setStep('form')} className="w-full rounded-xl edu-btn-primary h-11 font-bold">
                          Continue to Create →
                        </Button>
                      </div>
                    )}

                    {step === 'form' && (
                      <div className="space-y-4 mt-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-1 rounded-lg font-bold ${classroomType === 'google_linked' ? 'bg-blue-500/10 text-blue-600' : 'bg-primary/10 text-primary'}`}>
                            {classroomType === 'google_linked' ? '🔗 Google-linked' : '🎯 ESM-only'}
                          </span>
                        </div>
                        <Input placeholder="Class name (e.g. JEE Physics – Mechanics)" value={newName} onChange={e => setNewName(e.target.value)} className="rounded-xl h-12" />
                        <Input placeholder="Subject (optional)" value={newSubject} onChange={e => setNewSubject(e.target.value)} className="rounded-xl" />
                        <Input placeholder="Section (optional)" value={newSection} onChange={e => setNewSection(e.target.value)} className="rounded-xl" />
                        <Textarea placeholder="Description (optional)" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="rounded-xl" />
                        <div>
                          <label className="text-sm font-extrabold text-foreground">Google Classroom link (optional)</label>
                          <Input placeholder="https://classroom.google.com/c/... or class code" value={googleClassroomLink} onChange={e => setGoogleClassroomLink(e.target.value)} className="rounded-xl mt-1" />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setStep('type')} className="rounded-xl">Back</Button>
                          <Button onClick={createClassroom} disabled={!newName.trim()} className="flex-1 rounded-xl edu-btn-primary h-12 font-extrabold">Create 🎯</Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="edu-card p-6 h-40 animate-pulse bg-muted/40" />)}
            </div>
          ) : classrooms.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classrooms.map((c, i) => (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    onClick={() => router.push(`/classroom/${c.id}`)}
                    className="edu-card p-6 cursor-pointer hover:border-primary/30 transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground text-xl shadow-md">
                        {c.type === 'google_linked' ? '🔗' : '📚'}
                      </div>
                      {isTeacher && (
                        <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(c.join_code); toast({ title: 'Code copied!' }); }}
                          className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 hover:bg-muted/80">
                          <Copy className="w-3 h-3" /> {c.join_code}
                        </button>
                      )}
                    </div>
                    <h3 className="font-extrabold text-foreground text-lg group-hover:text-primary transition-colors">{c.name}</h3>
                    {c.subject && <p className="text-sm text-muted-foreground mt-0.5">{c.subject}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {c.section && <span className="edu-chip bg-muted text-muted-foreground">{c.section}</span>}
                      <span className="edu-chip bg-muted text-muted-foreground text-[10px]">{c.type === 'google_linked' ? 'Google' : 'ESM'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" /> View class
                    </div>
                  </motion.div>
                ))}
              </div>
              {!isTeacher && (exploreClassrooms.length > 0 || exploreLoading) && (
                <ExploreClassesSection
                  exploreClassrooms={exploreClassrooms.filter((ec) => !classrooms.some((my) => my.id === ec.id))}
                  exploreLoading={exploreLoading}
                  myRequestMap={myRequestMap}
                  myMemberClassroomIds={new Set(classrooms.map((c) => c.id))}
                  explorationEndedClassroomIds={explorationEndedClassroomIds}
                  requestingId={requestingId}
                  withdrawingId={withdrawingId}
                  onRequestJoin={handleRequestJoin}
                  onWithdrawRequest={handleWithdrawRequest}
                  onOpenClass={(id) => router.push(`/classroom/${id}`)}
                  onRefreshStatus={async () => { await refetchMyRequestMap(); await refetchExplorationEnded(); toast({ title: 'Status updated' }); }}
                />
              )}
            </div>
          ) : !isTeacher ? (
            <ExploreClassesSection
              exploreClassrooms={exploreClassrooms}
              exploreLoading={exploreLoading}
              myRequestMap={myRequestMap}
              myMemberClassroomIds={new Set()}
              explorationEndedClassroomIds={explorationEndedClassroomIds}
              requestingId={requestingId}
              withdrawingId={withdrawingId}
              onRequestJoin={handleRequestJoin}
              onWithdrawRequest={handleWithdrawRequest}
              onOpenClass={(id) => router.push(`/classroom/${id}`)}
              onRefreshStatus={async () => { await refetchMyRequestMap(); await refetchExplorationEnded(); toast({ title: 'Status updated' }); }}
              emptyTitle="No classrooms yet"
              emptySubtitle="Browse classes below and request to join, or use a code from your teacher with the button above."
            />
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-10 h-10 text-muted-foreground/40" />
              </div>
              <h3 className="font-display text-xl text-foreground mb-1">No classrooms yet</h3>
              <p className="text-muted-foreground text-sm">Create your first classroom to get started!</p>
            </div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default Classrooms;
