import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/useUserStore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { syncAllSavedContent } from "@/lib/saved/savedContentService";
import {
  resolveRevisionCardSaveLimit,
  revisionCardLimitToastCopy,
} from "@/lib/saved/revisionCardSaveLimit";
import { applyInstacueCreateDailyRdmReward } from "@/lib/rdm/claims/applyInstacueCreateDailyRdmReward";
import { RevisionCardType, Subject } from "@/types";
import { Brain, Calculator, AlertTriangle, Lightbulb, Plus } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CARD_TYPES: {
  value: RevisionCardType;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}[] = [
  {
    value: "concept",
    label: "Concept",
    icon: <Brain className="w-4 h-4" />,
    colorClass: "bg-amber-100 text-amber-800 border-amber-500",
  },
  {
    value: "formula",
    label: "Formula",
    icon: <Calculator className="w-4 h-4" />,
    colorClass: "bg-slate-100 text-slate-700 border-slate-500",
  },
  {
    value: "common_mistake",
    label: "Mistake",
    icon: <AlertTriangle className="w-4 h-4" />,
    colorClass: "bg-red-50 text-red-700 border-red-500",
  },
  {
    value: "trap",
    label: "Trap",
    icon: <Lightbulb className="w-4 h-4" />,
    colorClass: "bg-violet-50 text-violet-700 border-violet-500",
  },
];

export default function AddRevisionCardModal({ isOpen, onClose }: Props) {
  const user = useUserStore((s) => s.user);
  const saveRevisionCard = useUserStore((s) => s.saveRevisionCard);
  const unsaveRevisionCard = useUserStore((s) => s.unsaveRevisionCard);
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState<RevisionCardType>("concept");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !front || !back || !subject) return;

    const cardId = crypto.randomUUID();
    const savedCount = user?.savedRevisionCards?.length ?? 0;
    const limit = await resolveRevisionCardSaveLimit(profile, savedCount);
    if (limit.atLimit) {
      const copy = revisionCardLimitToastCopy(limit.cap);
      toast({ variant: "destructive", ...copy });
      return;
    }

    saveRevisionCard({
      id: cardId,
      type,
      frontContent: front,
      backContent: back,
      subtopicName: title,
      topic: "Custom",
      subject: subject.toLowerCase() as Subject,
      classLevel: 12,
      status: "new",
    });
    const sync = await syncAllSavedContent();
    if (!sync.ok) {
      unsaveRevisionCard(cardId);
      toast({
        variant: "destructive",
        title: sync.limitReached ? revisionCardLimitToastCopy(limit.cap).title : "Could not save",
        description: sync.error,
      });
      return;
    }

    const reward = await applyInstacueCreateDailyRdmReward({ refreshProfile });
    if (reward.awarded) {
      toast({
        title: "+5 RDM",
        description: "First InstaCue card you created today (IST). Keep learning!",
      });
    } else if (
      reward.reason &&
      reward.reason !== "already_claimed_today" &&
      reward.reason !== "not_authenticated"
    ) {
      toast({
        variant: "destructive",
        title: "Could not apply RDM bonus",
        description: reward.reason,
      });
    }

    setTitle("");
    setFront("");
    setBack("");
    setSubject("");
    setType("concept");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Add New Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="e.g., Newton's Third Law"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Front (Question/Trigger)</label>
            <Textarea
              placeholder="What you want to remember..."
              value={front}
              onChange={(e) => setFront(e.target.value)}
              required
              className="resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Back (Answer/Explanation)</label>
            <Textarea
              placeholder="The answer or explanation..."
              value={back}
              onChange={(e) => setBack(e.target.value)}
              required
              className="resize-none"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            <Input
              placeholder="e.g., Physics"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <div className="flex flex-wrap gap-2">
              {CARD_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    type === t.value
                      ? t.colorClass.split(" ").slice(0, 2).join(" ") +
                        " border-transparent ring-2 ring-primary/20"
                      : "bg-background hover:bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full mt-6 bg-[#172033] hover:bg-[#1f2b44] text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Card
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
