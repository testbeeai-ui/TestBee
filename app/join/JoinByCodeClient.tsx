"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import { normalizeReferralRef, persistPendingReferralRefFromUrl } from "@/lib/rdm/referral/referralClient";

const REFERRAL_LANDING_REDIRECT_SEC = 3;

type ClassroomRow = Database["public"]["Tables"]["classrooms"]["Row"];

export default function JoinByCodeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const codeFromUrl = useMemo(() => (params?.get("code") ?? "").trim().toUpperCase(), [params]);
  const refFromUrl = useMemo(() => (params?.get("ref") ?? "").trim(), [params]);
  const [code, setCode] = useState(codeFromUrl);
  const [classroom, setClassroom] = useState<ClassroomRow | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<"none" | "pending" | "approved" | "rejected">(
    "none"
  );
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState(REFERRAL_LANDING_REDIRECT_SEC);

  useEffect(() => {
    setCode(codeFromUrl);
  }, [codeFromUrl]);

  useEffect(() => {
    persistPendingReferralRefFromUrl(refFromUrl || null);
  }, [refFromUrl]);

  useEffect(() => {
    const validRef = Boolean(normalizeReferralRef(refFromUrl));
    const teacherCodeInUrl = codeFromUrl.trim().length >= 6;
    if (!validRef || teacherCodeInUrl) return;

    setInviteSecondsLeft(REFERRAL_LANDING_REDIRECT_SEC);
    const interval = window.setInterval(() => {
      setInviteSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    const go = window.setTimeout(() => {
      router.replace("/");
    }, REFERRAL_LANDING_REDIRECT_SEC * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(go);
    };
  }, [refFromUrl, codeFromUrl, router]);

  useEffect(() => {
    const fetchRoom = async () => {
      const c = code.trim().toUpperCase();
      if (!c || c.length < 6) {
        setClassroom(null);
        setLoadingRoom(false);
        return;
      }
      setLoadingRoom(true);
      const { data } = await supabase.from("classrooms").select("*").eq("join_code", c).maybeSingle();
      setClassroom(data ?? null);
      setLoadingRoom(false);
    };
    void fetchRoom();
  }, [code]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!user || !classroom) {
        setRequestStatus("none");
        return;
      }
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

  const goAuth = () => {
    const c = code.trim().toUpperCase();
    const r = refFromUrl.trim().toUpperCase();
    const qs = new URLSearchParams();
    if (c) qs.set("code", c);
    if (r) qs.set("ref", r);
    const next = qs.toString() ? `/join?${qs.toString()}` : "/join";
    router.replace(`/auth?next=${encodeURIComponent(next)}`);
  };

  const submitJoinRequest = async () => {
    if (!classroom) return;
    if (!user) {
      goAuth();
      return;
    }
    setSubmitting(true);
    try {
      if (requestStatus === "approved") {
        router.push(`/classroom/${classroom.id}`);
        return;
      }
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
      setSubmitting(false);
    }
  };

  const c = code.trim().toUpperCase();
  const canPreview = Boolean(classroom);
  const joinDisabled =
    submitting || loadingRoom || !canPreview || requestStatus === "pending" || requestStatus === "rejected";

  const normalizedRef = normalizeReferralRef(refFromUrl);
  const validRef = Boolean(normalizedRef);
  /** Teacher put a class code in the URL — stay on join flow (no auto-redirect to landing). */
  const teacherCodeInUrl = codeFromUrl.trim().length >= 6;
  /** Friend invite only: show popup and send user to landing to sign up; ref stays in sessionStorage. */
  const referralAutoLanding = validRef && !teacherCodeInUrl;

  if (referralAutoLanding) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-6 backdrop-blur-md">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="referral-invite-title"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm rounded-2xl border border-teal-500/35 bg-card p-8 text-center shadow-2xl"
        >
          <span className="text-5xl" aria-hidden>
            🎉
          </span>
          <h1 id="referral-invite-title" className="mt-4 font-display text-2xl font-semibold text-foreground">
            Your friend invited you
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Your invite is saved. Sign up or log in from the home page, then finish onboarding — you and your friend get
            RDM after that, once per account.
          </p>
          <p className="mt-5 text-xs font-medium text-teal-600 dark:text-teal-400/90">
            Opening the home page in {inviteSecondsLeft}s…
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-6 w-full rounded-xl"
            onClick={() => router.replace("/")}
          >
            Go now
          </Button>
        </motion.div>
      </div>
    );
  }

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
            <h1 className="text-2xl font-display text-foreground mb-1">Join a classroom</h1>
            <p className="text-sm text-muted-foreground">
              Enter the join code from your teacher. You’ll send a request — the teacher approves it.
            </p>
            {validRef ? (
              <p className="mt-3 text-xs text-teal-600 dark:text-teal-400/90 font-medium">
                Friend invite is saved — complete signup to reward them after onboarding.
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Join code</label>
              <Input
                value={c}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-character code"
                className="rounded-xl h-12 text-center text-lg tracking-widest font-extrabold"
                maxLength={16}
              />
            </div>

            {loadingRoom ? (
              <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                Checking classroom…
              </div>
            ) : classroom ? (
              <div className="rounded-xl bg-muted/20 border border-border/50 p-3">
                <div className="text-sm font-extrabold text-foreground">{classroom.name}</div>
                {classroom.subject ? <div className="text-xs text-muted-foreground">{classroom.subject}</div> : null}
                {requestStatus === "pending" ? (
                  <div className="mt-2 text-xs text-amber-600 font-bold">Request pending approval</div>
                ) : requestStatus === "rejected" ? (
                  <div className="mt-2 text-xs text-red-600 font-bold">Request rejected — contact your teacher</div>
                ) : requestStatus === "approved" ? (
                  <div className="mt-2 text-xs text-emerald-600 font-bold">You’re already in</div>
                ) : null}
              </div>
            ) : c ? (
              <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                No classroom found for this code.
              </div>
            ) : null}

            <Button
              onClick={submitJoinRequest}
              disabled={joinDisabled || authLoading}
              className="w-full rounded-xl edu-btn-primary h-12 text-base font-extrabold"
            >
              {!user
                ? "Sign in to request access"
                : requestStatus === "approved"
                  ? "Open class"
                  : "Send join request"}
            </Button>

            {requestStatus === "pending" ? (
              <p className="text-[11px] text-muted-foreground text-center">
                Once approved, the class will appear in your student dashboard automatically.
              </p>
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

