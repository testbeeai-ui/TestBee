"use client";

import Link from "next/link";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TOPIC_QUESTION_BANK_UPGRADE_PATH } from "@/lib/curriculum/topicQuestionBankAccess";

type TopicReferencesUpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function TopicReferencesUpgradeDialog({
  open,
  onOpenChange,
}: TopicReferencesUpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#262e3a] bg-[#151a22] text-[#eaeff5]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#eaeff5]">
            <Lock className="h-5 w-5 text-amber-400" aria-hidden />
            Unlock references with Starter or Pro
          </DialogTitle>
          <DialogDescription className="pt-2 text-left text-[#8b96a5]">
            If you already have an active Starter or Pro plan, references open automatically in this
            popup — close and reopen after your plan updates. Otherwise choose a plan below.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 rounded-lg border border-[#262e3a] bg-[#1b212b] p-3 text-sm text-[#eaeff5]">
          <li className="flex gap-2">
            <span className="text-[#1d9e75]">✓</span>
            Video &amp; reading links for each sub-topic
          </li>
          <li className="flex gap-2">
            <span className="text-[#1d9e75]">✓</span>
            Premium quiz sets 2–6 (same plan access)
          </li>
        </ul>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-[#262e3a] bg-transparent text-[#eaeff5] hover:bg-[#1b212b]"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-white hover:from-amber-600 hover:to-orange-600"
          >
            <Link href={TOPIC_QUESTION_BANK_UPGRADE_PATH} onClick={() => onOpenChange(false)}>
              <Crown className="mr-2 h-4 w-4" aria-hidden />
              View Starter &amp; Pro plans
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
