"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LiveQAHeaderProps {
  todayCount: number;
  onAskClick: () => void;
}

export default function LiveQAHeader({ todayCount, onAskClick }: LiveQAHeaderProps) {
  const { toast } = useToast();

  return (
    <div className="mb-4">
      {/* Title + live indicator */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="text-2xl font-extrabold text-foreground">Live Q&amp;A wall</h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live &middot; {todayCount} active
        </span>
      </div>

      {/* Ask bar — wraps on narrow center column so the input keeps priority */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
        <Input
          placeholder="Ask a doubt, add a question, or browse the wall..."
          className="rounded-xl flex-1 min-w-0 h-11"
          onFocus={onAskClick}
          readOnly
        />
        <div className="flex gap-2 shrink-0">
          <Button className="rounded-xl h-11 flex-1 sm:flex-initial font-bold px-5" onClick={onAskClick}>
            <Plus className="w-4 h-4 mr-1.5" /> Ask
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-11 flex-1 sm:flex-initial font-bold border-edu-orange text-edu-orange hover:bg-edu-orange/10"
            onClick={() => toast({ title: "AI-generated questions coming soon!" })}
          >
            <Sparkles className="w-4 h-4 sm:mr-1.5 shrink-0" />
            <span className="hidden min-[380px]:inline">AI generate Q</span>
            <span className="min-[380px]:hidden">AI Q</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
