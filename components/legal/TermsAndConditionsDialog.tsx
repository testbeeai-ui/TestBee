"use client";

import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TermsAndConditionsContent } from "@/components/legal/terms-and-conditions-content";
import { cn } from "@/lib/utils";

const SCROLL_ID = "terms-dialog-scroll";

type TermsAndConditionsDialogProps = {
  trigger: ReactNode;
  triggerClassName?: string;
};

function attachOpenHandler(trigger: ReactNode, onOpen: () => void): ReactNode {
  if (!isValidElement(trigger)) {
    return (
      <button type="button" className="font-semibold text-primary underline" onClick={onOpen}>
        {trigger}
      </button>
    );
  }

  const el = trigger as ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
  return cloneElement(el, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      el.props.onClick?.(e);
      onOpen();
    },
  });
}

/** Modal with the same content as `/terms-conditions/terms-and-conditions`. */
export function TermsAndConditionsDialog({
  trigger,
  triggerClassName,
}: TermsAndConditionsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span className={cn("inline", triggerClassName)}>
        {attachOpenHandler(trigger, () => setOpen(true))}
      </span>
      <DialogContent
        overlayClassName="z-[200]"
        className={cn(
          "z-[200] flex max-h-[min(92dvh,900px)] w-[min(96vw,52rem)] max-w-none flex-col gap-0 overflow-hidden",
          "border-white/15 bg-[#0E1117] p-0 text-[#E8EAF0] sm:rounded-2xl"
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-white/10 px-4 py-4 text-left sm:px-6">
          <DialogTitle className="text-lg font-semibold text-white sm:text-xl">
            Terms &amp; Conditions
          </DialogTitle>
          <DialogDescription className="text-xs text-white/50 sm:text-sm">
            Read the full agreement. Close this window when you are done, then tick the approval
            checkbox to continue.
          </DialogDescription>
        </DialogHeader>

        <div
          id={SCROLL_ID}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6"
        >
          <TermsAndConditionsContent scrollContainerId={SCROLL_ID} />
        </div>

        <div className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-6">
          <Button
            type="button"
            className="h-11 w-full rounded-xl bg-[#1D9E75] font-semibold text-[#0A2A20] hover:bg-[#1D9E75]/90"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
