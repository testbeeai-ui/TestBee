"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { useToast } from "@/hooks/use-toast";

type PendingRating = {
  sectionId: string;
  classroomId: string;
  occurrenceAt: string;
  title: string;
};

type PendingResponse = {
  ok?: boolean;
  hasPending?: boolean;
  sectionId?: string;
  classroomId?: string;
  occurrenceAt?: string;
  title?: string;
};

const DISMISS_PREFIX = "liveClassRatingDismissed.v1:";

function dismissKey(p: PendingRating): string {
  return `${DISMISS_PREFIX}${p.sectionId}:${p.occurrenceAt}`;
}

function isDismissed(p: PendingRating): boolean {
  try {
    return window.sessionStorage.getItem(dismissKey(p)) === "1";
  } catch {
    return false;
  }
}

function markDismissed(p: PendingRating): void {
  try {
    window.sessionStorage.setItem(dismissKey(p), "1");
  } catch {
    // ignore
  }
}

/**
 * Asks an enrolled student to rate the most recent ended live lesson (section
 * schedule occurrence) 1-5 stars while the rating window is open. The rating
 * drives the teacher's credit-only quality bonus; a low rating never penalizes.
 */
export default function LiveClassRatingPrompt({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingRating | null>(null);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithClientAuth("/api/classroom/live-class/pending-rating", {
          method: "GET",
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as PendingResponse;
        if (cancelled || !res.ok || !data.ok || !data.hasPending) return;
        if (!data.sectionId || !data.occurrenceAt || !data.classroomId) return;
        const p: PendingRating = {
          sectionId: data.sectionId,
          classroomId: data.classroomId,
          occurrenceAt: data.occurrenceAt,
          title: data.title?.trim() || "your live lesson",
        };
        if (isDismissed(p)) return;
        setPending(p);
        setOpen(true);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const submit = useCallback(async () => {
    if (!pending || selected < 1) return;
    setSubmitting(true);
    try {
      const res = await fetchWithClientAuth("/api/classroom/live-class/rate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: pending.sectionId,
          occurrenceAt: pending.occurrenceAt,
          stars: selected,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({
          title: "Could not save rating",
          description: data.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      markDismissed(pending);
      toast({ title: "Thanks for rating!", description: "Your feedback helps your teacher." });
      setOpen(false);
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [pending, selected, toast]);

  const close = useCallback(() => {
    if (pending) markDismissed(pending);
    setOpen(false);
  }, [pending]);

  if (!pending) return null;

  const active = hovered || selected;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden border-amber-200/50 dark:border-amber-900/30">
        <div className="bg-gradient-to-b from-amber-50 to-background dark:from-amber-950/20 p-6 space-y-5">
          <DialogHeader className="space-y-2 text-center">
            <DialogTitle className="font-display text-xl">
              How was{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-primary font-extrabold">
                {pending.title}
              </span>
              ?
            </DialogTitle>
            <DialogDescription className="text-sm">
              Rate the live lesson you just attended. This helps your teacher — a low rating never
              counts against them.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className="p-1 cursor-pointer"
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setSelected(n)}
              >
                <motion.span whileTap={{ scale: 0.8 }} className="inline-block">
                  <Star
                    className={
                      n <= active
                        ? "w-9 h-9 text-amber-400 fill-amber-400 drop-shadow-sm"
                        : "w-9 h-9 text-muted-foreground/40"
                    }
                  />
                </motion.span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full rounded-xl edu-btn-primary font-bold"
              disabled={selected < 1 || submitting}
              onClick={() => void submit()}
            >
              {submitting ? "Saving..." : "Submit rating"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={close}
              className="w-full text-muted-foreground hover:text-foreground rounded-xl"
            >
              Maybe later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
