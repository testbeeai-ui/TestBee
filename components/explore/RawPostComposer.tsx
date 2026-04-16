"use client";

import { useState, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { applyNormalizedPasteToField, normalizePastedMathForDoubt } from "@/lib/normalizePastedDoubtMath";

/** Stored on post — only these three (no life-science option in this composer). */
type PostSubjectSlug = "physics" | "chemistry" | "math";

const DIALOG_SUBJECTS: { slug: PostSubjectSlug; label: string }[] = [
  { slug: "physics", label: "Physics" },
  { slug: "chemistry", label: "Chemistry" },
  { slug: "math", label: "Math" },
];

export interface RawPostComposerProps {
  onPosted?: () => void;
}

export default function RawPostComposer({ onPosted }: RawPostComposerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [dialogSubject, setDialogSubject] = useState<PostSubjectSlug | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const displayName = profile?.name || user?.email?.split("@")[0] || "You";
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const submitWithSubject = useCallback(
    async (subject: PostSubjectSlug) => {
      if (!user?.id) {
        toast({ title: "Sign in required", description: "Please sign in to post.", variant: "destructive" });
        return false;
      }
      const nt = normalizePastedMathForDoubt(title.trim());
      const nb = normalizePastedMathForDoubt(body.trim());
      if (nt.length < 3) {
        toast({ title: "Too short", description: "Add a bit more in the main line first.", variant: "destructive" });
        return false;
      }

      setSubmitting(true);
      try {
        const { error } = await supabase.from("lessons_raw_posts").insert({
          user_id: user.id,
          kind: "post",
          title: nt,
          content: nb,
          tags: [],
          subject,
          chapter_ref: null,
        });
        if (error) {
          toast({ title: "Could not post", description: error.message, variant: "destructive" });
          return false;
        }
        setTitle("");
        setBody("");
        setDialogSubject(null);
        setSubjectPickerOpen(false);
        toast({ title: "Posted", description: "Your update is live on the feed." });
        onPosted?.();
        return true;
      } catch {
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [user?.id, title, body, toast, onPosted]
  );

  const openPostDialog = useCallback(() => {
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Please sign in to post.", variant: "destructive" });
      return;
    }
    const nt = normalizePastedMathForDoubt(title.trim());
    if (nt.length < 3) {
      toast({ title: "Too short", description: "Write a little more in the line above (at least 3 characters).", variant: "destructive" });
      return;
    }
    setDialogSubject(null);
    setSubjectPickerOpen(true);
  }, [user?.id, title, toast]);

  const handlePublishFromDialog = useCallback(() => {
    if (!dialogSubject) {
      toast({
        title: "Pick a subject",
        description: "Choose Physics, Chemistry, or Math before publishing.",
        variant: "destructive",
      });
      return;
    }
    void submitWithSubject(dialogSubject);
  }, [dialogSubject, submitWithSubject, toast]);

  const normalizedTitle = normalizePastedMathForDoubt(title.trim());
  const titlePreview = normalizedTitle.length > 120 ? `${normalizedTitle.slice(0, 120)}…` : normalizedTitle;

  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-2.5 dark:border-white/10 dark:bg-slate-950/80 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border">
          <AvatarFallback className="bg-primary/20 text-[10px] font-bold text-primary">{initials}</AvatarFallback>
        </Avatar>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text/plain");
            const el = e.currentTarget;
            const { value, caret } = applyNormalizedPasteToField(
              title,
              el.selectionStart ?? 0,
              el.selectionEnd ?? 0,
              pasted
            );
            setTitle(value);
            queueMicrotask(() => el.setSelectionRange(caret, caret));
          }}
          placeholder="Share something you learned today…"
          className="h-9 min-w-0 flex-1 border-0 bg-muted/50 text-sm shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-1 dark:bg-slate-900/50"
          disabled={submitting}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2 font-semibold text-primary hover:bg-primary/10 hover:text-primary"
          disabled={submitting}
          onClick={openPostDialog}
        >
          Post
        </Button>
      </div>

      <Dialog
        open={subjectPickerOpen}
        onOpenChange={(open) => {
          setSubjectPickerOpen(open);
          if (!open) setDialogSubject(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Finish your post</DialogTitle>
            <DialogDescription>Add optional details and confirm subject, then publish.</DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 dark:border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Headline</p>
            <p className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground">{titlePreview || "—"}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Details (optional)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData("text/plain");
                const el = e.currentTarget;
                const { value, caret } = applyNormalizedPasteToField(
                  body,
                  el.selectionStart ?? 0,
                  el.selectionEnd ?? 0,
                  pasted
                );
                setBody(value);
                queueMicrotask(() => el.setSelectionRange(caret, caret));
              }}
              placeholder="Optional: more context, steps, or paste"
              rows={4}
              disabled={submitting}
              className="min-h-[88px] resize-y rounded-xl border-border bg-background font-mono text-sm dark:bg-slate-950/80"
            />
            <p className="text-[10px] text-muted-foreground">Math normalizes on paste, same as Gyan++.</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold">
              Subject <span className="text-destructive">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {DIALOG_SUBJECTS.map(({ slug, label }) => (
                <Button
                  key={slug}
                  type="button"
                  variant={dialogSubject === slug ? "default" : "outline"}
                  size="sm"
                  className="rounded-full font-bold"
                  disabled={submitting}
                  onClick={() => setDialogSubject(slug)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={submitting}
              onClick={() => setSubjectPickerOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl font-bold"
              disabled={submitting || !dialogSubject}
              onClick={handlePublishFromDialog}
            >
              {submitting ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
