"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import {
  normalizeReferralRef,
  persistPendingReferralRefFromUrl,
} from "@/lib/rdm/referral/referralClient";

const REFERRAL_LANDING_REDIRECT_SEC = 3;

type ClassroomRow = Database["public"]["Tables"]["classrooms"]["Row"];

type JoinPreview = {
  classroom: ClassroomRow;
  teacherName: string | null;
};

async function lookupClassroomByCode(code: string): Promise<JoinPreview | null> {
  const res = await fetch(`/api/join/lookup?code=${encodeURIComponent(code)}`);
  if (res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      classroom?: ClassroomRow | null;
      teacherName?: string | null;
    } | null;
    if (payload?.classroom) {
      return { classroom: payload.classroom, teacherName: payload.teacherName ?? null };
    }
    return null;
  }

  const { data } = await supabase.rpc("lookup_classroom_by_join_code", { p_code: code });
  const rpcPayload = data as { ok?: boolean; classroom?: ClassroomRow | null } | null;
  if (!rpcPayload?.classroom) return null;
  return { classroom: rpcPayload.classroom, teacherName: null };
}

export default function JoinByCodeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const codeFromUrl = useMemo(() => (params?.get("code") ?? "").trim().toUpperCase(), [params]);
  const refFromUrl = useMemo(() => (params?.get("ref") ?? "").trim(), [params]);
  const isTeacherInvite = codeFromUrl.length >= 6;

  const [code, setCode] = useState(codeFromUrl);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [joinState, setJoinState] = useState<"none" | "joined" | "pending" | "rejected">("none");
  const [inviteSecondsLeft, setInviteSecondsLeft] = useState(REFERRAL_LANDING_REDIRECT_SEC);

  const classroom = preview?.classroom ?? null;
  const teacherName = preview?.teacherName ?? null;

  useEffect(() => {
    setCode(codeFromUrl);
  }, [codeFromUrl]);

  useEffect(() => {
    persistPendingReferralRefFromUrl(refFromUrl || null);
  }, [refFromUrl]);

  useEffect(() => {
    const validRef = Boolean(normalizeReferralRef(refFromUrl));
    if (!validRef || isTeacherInvite) return;

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
  }, [refFromUrl, isTeacherInvite, router]);

  useEffect(() => {
    const fetchRoom = async () => {
      const c = code.trim().toUpperCase();
      if (!c || c.length < 6) {
        setPreview(null);
        setLoadingRoom(false);
        return;
      }
      setLoadingRoom(true);
      try {
        setPreview(await lookupClassroomByCode(c));
      } catch {
        setPreview(null);
      } finally {
        setLoadingRoom(false);
      }
    };
    void fetchRoom();
  }, [code]);

  const tryAutoJoinFromInvite = useCallback(async () => {
    if (!classroom || !user) return false;

    const { data: member } = await supabase
      .from("classroom_members")
      .select("user_id")
      .eq("classroom_id", classroom.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (member) {
      setJoinState("joined");
      return true;
    }

    if (isTeacherInvite) {
      try {
        const res = await fetch("/api/user/classroom-invites/link", {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; linked?: number };
        if (res.ok && data.ok && (data.linked ?? 0) > 0) {
          setJoinState("joined");
          toast({
            title: `Welcome to ${classroom.name}!`,
            description: "You're in the class — no teacher approval needed.",
          });
          return true;
        }
      } catch {
        // fall through to join-request check
      }
    }

    const { data: req } = await supabase
      .from("classroom_join_requests")
      .select("status")
      .eq("classroom_id", classroom.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (req?.status === "pending") {
      setJoinState("pending");
      return true;
    }
    if (req?.status === "rejected") {
      setJoinState("rejected");
      return true;
    }
    if (req?.status === "approved") {
      setJoinState("joined");
      return true;
    }

    setJoinState("none");
    return false;
  }, [classroom, user, isTeacherInvite, toast]);

  useEffect(() => {
    void tryAutoJoinFromInvite();
  }, [tryAutoJoinFromInvite]);

  const goAuth = () => {
    const c = code.trim().toUpperCase();
    const r = refFromUrl.trim().toUpperCase();
    const qs = new URLSearchParams();
    if (c) qs.set("code", c);
    if (r) qs.set("ref", r);
    const next = qs.toString() ? `/join?${qs.toString()}` : "/join";
    router.replace(`/auth?next=${encodeURIComponent(next)}`);
  };

  const submitJoin = async () => {
    if (!classroom) return;
    if (!user) {
      goAuth();
      return;
    }

    setSubmitting(true);
    try {
      if (joinState === "joined") {
        router.push(`/classroom/${classroom.id}`);
        return;
      }

      if (isTeacherInvite) {
        if (joinState === "joined") {
          router.push(`/classroom/${classroom.id}`);
          return;
        }

        const res = await fetch("/api/user/classroom-invites/link", {
          method: "POST",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; linked?: number };
        if (res.ok && data.ok && (data.linked ?? 0) > 0) {
          setJoinState("joined");
          router.push(`/classroom/${classroom.id}`);
          return;
        }

        const { data: member } = await supabase
          .from("classroom_members")
          .select("user_id")
          .eq("classroom_id", classroom.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (member) {
          router.push(`/classroom/${classroom.id}`);
          return;
        }

        toast({
          title: "Use your invited email",
          description:
            "Sign in with the same email address your teacher added to the class list. You'll join automatically after signup.",
          variant: "destructive",
        });
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
          setJoinState("pending");
        } else {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
        return;
      }
      toast({ title: "Request sent", description: "The teacher will approve you soon." });
      setJoinState("pending");
    } finally {
      setSubmitting(false);
    }
  };

  const c = code.trim().toUpperCase();
  const canPreview = Boolean(classroom);
  const joinDisabled =
    submitting || loadingRoom || !canPreview || joinState === "pending" || joinState === "rejected";

  const normalizedRef = normalizeReferralRef(refFromUrl);
  const validRef = Boolean(normalizedRef);
  const referralAutoLanding = validRef && !isTeacherInvite;

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
          <h1
            id="referral-invite-title"
            className="mt-4 font-display text-2xl font-semibold text-foreground"
          >
            Your friend invited you
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Your invite is saved. Sign up or log in from the home page, then finish onboarding — you
            and your friend get RDM after that, once per account.
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

  const inviteHeadline = isTeacherInvite ? "You're invited to join a class" : "Join a classroom";
  const inviteSubtext = isTeacherInvite
    ? teacherName
      ? `${teacherName} invited you to join ${classroom?.name ?? "their class"} on EduBlast. Sign up with the email your teacher used — you'll join automatically.`
      : "Your teacher invited you to join their class on EduBlast. Sign up with the email they used for you — you'll join automatically."
    : "Enter the join code from your teacher. You'll send a request — the teacher approves it.";

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
            <span className="text-5xl block mb-4">{isTeacherInvite ? "✉️" : "📚"}</span>
            <h1 className="text-2xl font-display text-foreground mb-1">{inviteHeadline}</h1>
            <p className="text-sm text-muted-foreground">{inviteSubtext}</p>
            {validRef ? (
              <p className="mt-3 text-xs text-teal-600 dark:text-teal-400/90 font-medium">
                Friend invite is saved — complete signup to reward them after onboarding.
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            {!isTeacherInvite ? (
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
            ) : null}

            {loadingRoom ? (
              <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                Loading your invitation…
              </div>
            ) : classroom ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3">
                <div className="text-sm font-extrabold text-foreground">{classroom.name}</div>
                {classroom.subject ? (
                  <div className="text-xs text-muted-foreground">{classroom.subject}</div>
                ) : null}
                {teacherName ? (
                  <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    Teacher: {teacherName}
                  </div>
                ) : null}
                {joinState === "joined" ? (
                  <div className="mt-2 text-xs font-bold text-emerald-600">
                    You&apos;re in this class
                  </div>
                ) : joinState === "pending" ? (
                  <div className="mt-2 text-xs font-bold text-amber-600">
                    Request pending approval
                  </div>
                ) : joinState === "rejected" ? (
                  <div className="mt-2 text-xs font-bold text-red-600">
                    Request rejected — contact your teacher
                  </div>
                ) : isTeacherInvite ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Sign up or sign in to join — no approval needed if your email is on the class
                    list.
                  </div>
                ) : null}
              </div>
            ) : c ? (
              <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                No classroom found for this code.
              </div>
            ) : null}

            <Button
              onClick={submitJoin}
              disabled={joinDisabled || authLoading}
              className="w-full rounded-xl edu-btn-primary h-12 text-base font-extrabold"
            >
              {!user
                ? isTeacherInvite
                  ? "Sign up & join class"
                  : "Sign in to request access"
                : joinState === "joined"
                  ? "Open class"
                  : isTeacherInvite
                    ? "Join class now"
                    : "Send join request"}
            </Button>

            {isTeacherInvite && !user ? (
              <p className="text-[11px] text-muted-foreground text-center">
                Already have an account?{" "}
                <button type="button" className="font-semibold text-primary underline" onClick={goAuth}>
                  Sign in
                </button>
              </p>
            ) : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
