"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import AdminRequestTemplate from "@/components/AdminRequestTemplate";
import type { Database } from "@/integrations/supabase/types";

type ClassroomRow = Database["public"]["Tables"]["classrooms"]["Row"];

const JoinClassroom = () => {
  const params = useParams();
  const classId = params?.classId as string | undefined;
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [classroom, setClassroom] = useState<ClassroomRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [requestStatus, setRequestStatus] = useState<"none" | "pending" | "approved" | "rejected">(
    "none"
  );

  useEffect(() => {
    if (!classId) return;
    supabase
      .from("classrooms")
      .select("*")
      .eq("id", classId)
      .maybeSingle()
      .then(({ data }) => {
        setClassroom(data);
        setLoading(false);
      });
  }, [classId]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!user || !classroom) return;
      const { data: member } = await supabase
        .from("classroom_members")
        .select("user_id")
        .eq("classroom_id", classroom.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (member) {
        setRequestStatus("approved");
        return;
      }
      const { data: req } = await supabase
        .from("classroom_join_requests")
        .select("status")
        .eq("classroom_id", classroom.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (req?.status === "pending" || req?.status === "approved" || req?.status === "rejected") {
        setRequestStatus(req.status);
      } else {
        setRequestStatus("none");
      }
    };
    void fetchStatus();
  }, [user, classroom]);

  const joinButtonLabel = useMemo(() => {
    if (!classroom) return "";
    if (requestStatus === "approved") return "Open class";
    if (requestStatus === "pending") return "Request pending";
    if (requestStatus === "rejected") return "Request rejected";
    const googleLinked = classroom.type === "google_linked";
    return googleLinked ? "Request ESM access (no Google)" : "Send join request";
  }, [classroom, requestStatus]);

  if (authLoading || loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-4xl animate-pulse">📚</span>
      </div>
    );
  if (!user) {
    const next = classId ? `/join/${encodeURIComponent(classId)}` : "/join";
    router.replace(`/auth?next=${encodeURIComponent(next)}`);
    return null;
  }
  if (!classroom)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h2 className="font-display text-2xl">Classroom not found</h2>
      </div>
    );

  const isGoogleLinked = classroom.type === "google_linked";

  const handleJoin = async () => {
    setJoining(true);
    try {
      if (requestStatus === "approved") {
        router.push(`/classroom/${classroom.id}`);
        return;
      }
      if (requestStatus === "pending" || requestStatus === "rejected") return;

      const { error } = await supabase.from("classroom_join_requests").insert({
        classroom_id: classroom.id,
        user_id: user.id,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Request already exists", description: "Wait for teacher approval." });
          setRequestStatus("pending");
        } else {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
        return;
      }
      toast({ title: "Request sent", description: "The teacher will approve you soon." });
      setRequestStatus("pending");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="absolute inset-0 gradient-hero opacity-95" />
      <div className="relative flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl p-8 shadow-2xl w-full max-w-md border border-border/50"
        >
          <div className="text-center mb-6">
            <span className="text-5xl block mb-4">📚</span>
            <h1 className="text-2xl font-display text-foreground mb-1">{classroom.name}</h1>
            {classroom.subject && <p className="text-muted-foreground">{classroom.subject}</p>}
            {classroom.google_classroom_id && (
              <div className="mt-3">
                <a
                  href={
                    classroom.google_classroom_id.startsWith("http")
                      ? classroom.google_classroom_id
                      : "https://classroom.google.com"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                >
                  Open in Google Classroom
                </a>
                {!classroom.google_classroom_id.startsWith("http") && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    (Code: {classroom.google_classroom_id})
                  </span>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              You&apos;ve been invited to join this classroom
            </p>
          </div>

          {!showFallback ? (
            <div className="space-y-3">
              <Button
                onClick={() => void handleJoin()}
                disabled={joining || requestStatus === "pending" || requestStatus === "rejected"}
                className="w-full rounded-xl edu-btn-primary h-12 text-base font-extrabold"
              >
                {joining ? "Sending..." : joinButtonLabel}
              </Button>

              {isGoogleLinked && (
                <button
                  onClick={() => setShowFallback(true)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                >
                  Having trouble with Google? See alternatives →
                </button>
              )}
              {requestStatus === "pending" ? (
                <p className="text-[11px] text-muted-foreground text-center">
                  Once approved, the class will appear in your dashboard automatically.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <h3 className="font-bold text-sm text-foreground mb-1">🔒 Domain restrictions?</h3>
                <p className="text-xs text-muted-foreground">
                  Your school policy may block external Classroom access. Here are your options:
                </p>
              </div>

              <Button
                onClick={() => void handleJoin()}
                disabled={joining || requestStatus === "pending" || requestStatus === "rejected"}
                className="w-full rounded-xl edu-btn-primary h-12 font-extrabold"
              >
                {joining ? "Sending..." : joinButtonLabel}
              </Button>

              {classroom.join_code && (
                <div className="bg-muted/30 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Google Classroom code:</p>
                  <p className="font-mono text-lg font-extrabold text-foreground tracking-widest">
                    {classroom.join_code}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Enter this in classroom.google.com
                  </p>
                </div>
              )}

              <AdminRequestTemplate />

              <button
                onClick={() => setShowFallback(false)}
                className="w-full text-xs text-primary hover:underline"
              >
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
