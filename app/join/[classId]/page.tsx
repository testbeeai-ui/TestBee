"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import AdminRequestTemplate from '@/components/AdminRequestTemplate';

const JoinClassroom = () => {
  const params = useParams();
  const classId = params?.classId as string | undefined;
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [classroom, setClassroom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!classId) return;
    supabase.from('classrooms').select('*').eq('id', classId).maybeSingle().then(({ data }) => {
      setClassroom(data);
      setLoading(false);
    });
  }, [classId]);

  if (authLoading || loading) return <div className="min-h-screen flex items-center justify-center"><span className="text-4xl animate-pulse">📚</span></div>;
  if (!user) { router.replace('/auth'); return null; }
  if (!classroom) return <div className="min-h-screen flex items-center justify-center"><h2 className="font-display text-2xl">Classroom not found</h2></div>;

  const isGoogleLinked = classroom.type === 'google_linked';

  const handleJoin = async (method: 'esm' | 'google') => {
    setJoining(true);
    const { error } = await supabase.from('classroom_members').insert({ classroom_id: classroom.id, user_id: user.id, role: 'student' });
    if (error) {
      if (error.code === '23505') { toast({ title: 'Already a member!' }); router.push(`/classroom/${classroom.id}`); }
      else toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      if (method === 'google' && isGoogleLinked) {
        toast({ title: 'Joined ESM! 🎉', description: 'Google Classroom sync pending — connect Google later in settings.' });
      } else {
        toast({ title: 'Joined! 🎉' });
      }
      router.push(`/classroom/${classroom.id}`);
    }
    setJoining(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="absolute inset-0 gradient-hero opacity-95" />
      <div className="relative flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-3xl p-8 shadow-2xl w-full max-w-md border border-border/50">
          <div className="text-center mb-6">
            <span className="text-5xl block mb-4">📚</span>
            <h1 className="text-2xl font-display text-foreground mb-1">{classroom.name}</h1>
            {classroom.subject && <p className="text-muted-foreground">{classroom.subject}</p>}
            {classroom.google_classroom_id && (
              <div className="mt-3">
                <a href={classroom.google_classroom_id.startsWith('http') ? classroom.google_classroom_id : 'https://classroom.google.com'} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                  Open in Google Classroom
                </a>
                {!classroom.google_classroom_id.startsWith('http') && (
                  <span className="ml-2 text-sm text-muted-foreground">(Code: {classroom.google_classroom_id})</span>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">You've been invited to join this classroom</p>
          </div>

          {!showFallback ? (
            <div className="space-y-3">
              {isGoogleLinked && (
                <Button onClick={() => handleJoin('google')} disabled={joining} className="w-full rounded-xl h-12 text-base font-extrabold gap-2 bg-card border-2 border-border text-foreground hover:bg-muted">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  {joining ? 'Joining...' : 'Continue with Google'}
                </Button>
              )}
              <Button onClick={() => handleJoin('esm')} disabled={joining} className="w-full rounded-xl edu-btn-primary h-12 text-base font-extrabold">
                {joining ? 'Joining...' : isGoogleLinked ? 'Join ESM Only (no Google)' : 'Join Classroom 🚀'}
              </Button>

              {isGoogleLinked && (
                <button onClick={() => setShowFallback(true)} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
                  Having trouble with Google? See alternatives →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <h3 className="font-bold text-sm text-foreground mb-1">🔒 Domain restrictions?</h3>
                <p className="text-xs text-muted-foreground">Your school policy may block external Classroom access. Here are your options:</p>
              </div>

              <Button onClick={() => handleJoin('esm')} disabled={joining} className="w-full rounded-xl edu-btn-primary h-12 font-extrabold">
                Join ESM Class Only 🚀
              </Button>

              {classroom.join_code && (
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Google Classroom code:</p>
                  <p className="font-mono text-lg font-extrabold text-foreground tracking-widest">{classroom.join_code}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Enter this in classroom.google.com</p>
                </div>
              )}

              <AdminRequestTemplate />

              <button onClick={() => setShowFallback(false)} className="w-full text-xs text-primary hover:underline">
                ← Back to join options
              </button>
            </div>
          )}

          {!isGoogleLinked && (
            <p className="text-[11px] text-muted-foreground text-center mt-4">
              You can connect Google later in your profile settings.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default JoinClassroom;
