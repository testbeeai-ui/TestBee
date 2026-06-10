"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_OPTIONS } from "@/components/waitlist/waitlist-constants";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string | null;
  progress: number;
  children: React.ReactNode;
};

const roleLabel = (id: string | null) =>
  ROLE_OPTIONS.find((r) => r.id === id)?.name ?? "Ambassador";

export function AmbassadorApplicationModal({
  open,
  onOpenChange,
  role,
  progress,
  children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden border-[#2A3347] bg-[#0D1117] p-0 text-[#E8EAF0] sm:max-w-2xl">
        <div className="shrink-0 border-b border-[#2A3347] bg-[#161C26] px-5 pb-4 pt-5 pr-12">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-base font-medium text-white">
              Complete your {roleLabel(role)} profile
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-[#9BA3B8]">
              Fill in all required fields to apply for the EduBlast Ambassador programme.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[#2A3347]">
            <div
              className="h-full bg-[#1D9E75] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
