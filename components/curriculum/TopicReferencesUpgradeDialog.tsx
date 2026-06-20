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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" aria-hidden />
            Upgrade to unlock references
          </DialogTitle>
          <DialogDescription className="pt-2 text-left">
            Video and reading references for this subtopic are available on Starter and Pro plans.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
