"use client";

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface CommentInputProps {
  doubtId: string;
  onCommentPosted: () => void;
  avatarUrl?: string | null;
  userName?: string | null;
}

export default function CommentInput({ doubtId, onCommentPosted, avatarUrl, userName }: CommentInputProps) {
  const { user } = useAuth();
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
      const { error } = await supabase.from("doubt_answers").insert({
        doubt_id: doubtId,
        user_id: user.id,
        body,
      });
      if (error) throw error;
      setText("");
      setExpanded(false);
      toast({ title: "+5 RDM earned for commenting!" });
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

  return (
    <div className="flex items-start gap-2 pt-3 border-t border-border/40">
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
          placeholder="Add a comment — earn +5 RDM..."
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
            <Button size="sm" className="rounded-lg h-7 text-xs" onClick={handlePost} disabled={posting || !text.trim()}>
              {posting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Post"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
