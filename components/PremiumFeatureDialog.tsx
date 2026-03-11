"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface PremiumFeatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Action label for the 2 RDM button, e.g. "Save Bit", "Regenerate", "Save Formula" */
  actionLabel: string;
  /** Called when user confirms "for 2 RDM" - no actual RDM deduction, text only */
  onConfirm: () => void;
}

export default function PremiumFeatureDialog({
  open,
  onOpenChange,
  actionLabel,
  onConfirm,
}: PremiumFeatureDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleTakePremium = () => {
    onOpenChange(false);
    // Future: navigate to pricing or premium upgrade
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Premium Feature
          </DialogTitle>
          <DialogDescription>
            For premium users this feature is unlimited. Do you want to take
            premium, or do you want to proceed for 2 RDM?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
          <Button variant="outline" onClick={handleTakePremium}>
            Take Premium
          </Button>
          <Button onClick={handleConfirm} className="bg-amber-600 hover:bg-amber-700">
            {actionLabel} for 2 RDM
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
