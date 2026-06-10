"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface CommentInputProps {
  doubtId: string;
  onCommentPosted: () => void;
  avatarUrl?: string | null;
  userName?: string | null;
  /** Teachers post into the teacher section (same table); copy matches that area. */
  variant?: "student" | "teacher";
  /** Investor Gyan++ wall — rounded input + teal send button. */
  appearance?: "default" | "gyan";
  commentRewardRdm?: number;
}

export default function CommentInput({
  doubtId,
  onCommentPosted,
  avatarUrl,
  userName,
  variant = "student",
  appearance = "default",
  commentRewardRdm = 5,
}: CommentInputProps) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!user) return null;

  const initials = (userName ?? "Y").slice(0, 2).toUpperCase();

  const handlePost = async () => {
    if (posting) return;
    const body = text.trim();
    if (!body) return;
    setPosting(true);
    try {
      const { data: beforeBal } = await supabase
        .from("profiles")
        .select("rdm")
        .eq("id", user.id)
        .maybeSingle();
      const beforeRdm = (beforeBal as { rdm?: number } | null)?.rdm ?? 0;
      const { error } = await supabase.from("doubt_answers").insert({
        doubt_id: doubtId,
        user_id: user.id,
        body,
      });
      if (error) throw error;
      const { data: afterBal } = await supabase
        .from("profiles")
        .select("rdm")
        .eq("id", user.id)
        .maybeSingle();
      const afterRdm = (afterBal as { rdm?: number } | null)?.rdm ?? beforeRdm;
      const gained = afterRdm - beforeRdm;
      setText("");
      setExpanded(false);
      toast({
        title: variant === "teacher" ? "Teacher note posted!" : "Comment posted!",
        description:
          variant !== "teacher" && gained >= commentRewardRdm
            ? `+${commentRewardRdm} RDM — first comment milestone today (IST).`
            : undefined,
      });
      void refreshProfile();
      onCommentPosted();
    } catch (error: unknown) {
      const description =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Network error. Please try again.";
      toast({ title: "Could not post comment", description, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  if (appearance === "gyan") {
    return (
      <div className="flex items-center gap-2 py-2">
        <Avatar className="h-[26px] w-[26px] rounded-full shrink-0">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback className="rounded-full text-[11px] font-medium bg-[#5B9A85] text-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder={
            variant === "teacher"
              ? "Add a teacher note (exam tips, corrections)…"
              : "Add a comment on this question…"
          }
          className="flex-1 min-w-0 rounded-full border border-[#2A3347] bg-[#1C2333] px-3 py-1.5 text-xs font-sans text-[#E8EAF0] placeholder:text-[#5C6480] outline-none focus:border-[#5B9A85]"
          disabled={posting}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim() && !posting) {
              e.preventDefault();
              void handlePost();
            }
          }}
        />
        <button
          type="button"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#5B9A85] text-white hover:bg-[#4A826F] transition-colors disabled:opacity-50"
          onClick={() => void handlePost()}
          disabled={posting || !text.trim()}
          aria-label="Post comment"
        >
          {posting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 pt-3 border-t ${
        variant === "teacher" ? "border-emerald-500/25" : "border-border/40"
      }`}
    >
      <Avatar className="h-7 w-7 rounded-full shrink-0 mt-0.5">
        <AvatarImage src={avatarUrl ?? undefined} />
        <AvatarFallback className="rounded-full text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setExpanded(true)}
          placeholder={
            variant === "teacher"
              ? "Add a teacher note (exam tips, corrections)…"
              : `Add a comment — up to +${commentRewardRdm} RDM once today (IST)...`
          }
          className="w-full text-sm bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground py-1"
          disabled={posting}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim() && !posting) {
              e.preventDefault();
              handlePost();
            }
          }}
        />
        {expanded && text.trim() && (
          <div className="flex justify-end mt-1">
            <Button
              size="sm"
              className="rounded-lg h-7 text-xs"
              onClick={handlePost}
              disabled={posting || !text.trim()}
            >
              {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Post"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
