"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function ChatButton({ buddyName }: { buddyName: string | null }) {
  const { toast } = useToast();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 w-full rounded-lg border-cyan-500/30 bg-cyan-500/[0.08] text-[12.5px] font-semibold text-cyan-100 hover:bg-cyan-500/15"
      onClick={() =>
        toast({
          title: "Chat is coming soon",
          description: buddyName
            ? `We're building a private chat with ${buddyName} — stay tuned.`
            : "Private buddy chat is coming soon.",
        })
      }
    >
      <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
      Chat with buddy
    </Button>
  );
}
