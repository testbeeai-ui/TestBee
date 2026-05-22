"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { acceptBuddyInvite, previewBuddyInvite, type BuddyInvitePreview } from "@/lib/buddy/buddyClient";

const BUDDY_PENDING_TOKEN_KEY = "buddy_pending_token";

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; preview: BuddyInvitePreview }
  | { phase: "error"; message: string }
  | { phase: "accepted"; alreadyPaired: boolean; referralCredited: boolean };

function storePendingToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BUDDY_PENDING_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

function readPendingToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(BUDDY_PENDING_TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearPendingToken() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(BUDDY_PENDING_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export default function BuddyJoinClient({ token }: { token: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const preview = await previewBuddyInvite(token);
        if (cancelled) return;
        setState({ phase: "ready", preview });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Couldn't load this invite. Please try again.";
        setState({ phase: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = useCallback(async () => {
    setSubmitting(true);
    try {
      const result = await acceptBuddyInvite(token);
      clearPendingToken();
      setState({
        phase: "accepted",
        alreadyPaired: Boolean(result.alreadyPaired),
        referralCredited: Boolean(result.referralCredited),
      });
      toast({
        title: result.alreadyPaired ? "You're already buddies" : "Buddy paired",
        description: result.referralCredited
          ? "Bonus referral RDM was also credited."
          : "You can now see each other's learning activity.",
      });
      setTimeout(() => {
        router.replace("/refer-earn?tab=learning_buddy");
      }, 900);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn't pair you. Try again later.";
      toast({ title: "Pairing failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [router, toast, token]);

  // Auto-accept after returning from signup, if a token was persisted for this user.
  useEffect(() => {
    if (authLoading || !user) return;
    if (state.phase !== "ready") return;
    const pending = readPendingToken();
    if (pending && pending === token) {
      void handleAccept();
    }
  }, [authLoading, user, state.phase, token, handleAccept]);

  const goSignup = () => {
    storePendingToken(token);
    const next = `/buddy-join/${encodeURIComponent(token)}`;
    router.replace(`/auth?mode=signup&next=${encodeURIComponent(next)}`);
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-background to-cyan-500/10" />
      <div className="relative flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md rounded-3xl border border-border/60 bg-card/95 backdrop-blur p-7 shadow-2xl"
        >
          {state.phase === "loading" ? (
            <div className="text-center text-sm text-muted-foreground">
              <span className="block text-4xl animate-pulse" aria-hidden>
                🤝
              </span>
              <p className="mt-3">Loading buddy invite…</p>
            </div>
          ) : null}

          {state.phase === "error" ? (
            <div className="text-center">
              <span className="block text-4xl" aria-hidden>
                ⚠️
              </span>
              <h1 className="mt-3 font-display text-xl font-semibold">Invite unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
              <Button
                className="mt-5 w-full rounded-xl"
                variant="secondary"
                onClick={() => router.replace("/")}
              >
                Go home
              </Button>
            </div>
          ) : null}

          {state.phase === "ready" ? (
            <div className="text-center">
              <span className="block text-4xl" aria-hidden>
                🤝
              </span>
              <h1 className="mt-3 font-display text-xl font-semibold text-foreground">
                {state.preview.inviter?.name
                  ? `${state.preview.inviter.name} wants you as their study buddy`
                  : "You're invited as a study buddy"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Track each other's progress on Gyan++, subtopics, Play Arena, and mock tests. Push each
                other to stay consistent.
              </p>

              {state.preview.invite.status !== "pending" ? (
                <p className="mt-4 text-xs font-medium text-amber-600">
                  This invite is {state.preview.invite.status}.
                </p>
              ) : null}

              {authLoading ? (
                <div className="mt-5 text-xs text-muted-foreground">Checking your session…</div>
              ) : user ? (
                <Button
                  type="button"
                  disabled={submitting || state.preview.invite.status !== "pending"}
                  onClick={() => void handleAccept()}
                  className="mt-5 w-full rounded-xl edu-btn-primary h-12 text-base font-extrabold"
                >
                  {submitting
                    ? "Pairing…"
                    : state.preview.invite.status !== "pending"
                      ? "Invite unavailable"
                      : `Become ${state.preview.inviter?.name ?? "their"} buddy`}
                </Button>
              ) : (
                <div className="mt-5 space-y-2">
                  <Button
                    type="button"
                    className="w-full rounded-xl edu-btn-primary h-12 text-base font-extrabold"
                    disabled={state.preview.invite.status !== "pending"}
                    onClick={goSignup}
                  >
                    Sign up to join
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    New here? You'll also earn referral RDM after onboarding.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {state.phase === "accepted" ? (
            <div className="text-center">
              <span className="block text-4xl" aria-hidden>
                ✨
              </span>
              <h1 className="mt-3 font-display text-xl font-semibold text-foreground">
                {state.alreadyPaired ? "You're already buddies" : "Buddy paired!"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Heading to your Learning Buddy dashboard…
                {state.referralCredited ? " Referral RDM credited." : ""}
              </p>
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
