"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DiveButton from "../ui/DiveButton";
import styles from "../styles";

type UndertakingDialogProps = {
  open: boolean;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  onAgree: () => void;
  onDismiss: () => void;
};

export default function UndertakingDialog({
  open,
  checked,
  onCheckedChange,
  onAgree,
  onDismiss,
}: UndertakingDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <DialogContent
        className="max-w-md w-[calc(100vw-2rem)] border border-slate-700/80 !bg-[#0b0f17] p-0 text-slate-100 shadow-2xl sm:rounded-2xl overflow-hidden"
        overlayClassName="bg-black/85 backdrop-blur-sm"
      >
        <DialogHeader className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#0d121c] text-left">
          <DialogTitle className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
            <span>✍️</span>
            <span>Read carefully before you continue</span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4 bg-[#0b0f17]">
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Please read these instructions carefully before Quiz, Numerals, or Learning Outcomes.
          </p>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-[13px] leading-relaxed text-amber-200 shadow-sm">
            <strong className="block text-amber-300 font-bold mb-1">Undertaking:</strong>
            Using AI to answer questions or problems directly is a shortcut and not a true reflection of my capability. Such frequent use will prevent me from learning deeper and can reduce my recall of concepts during an exam, where AI use shall be blocked or not allowed.
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 cursor-pointer hover:border-slate-700 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-800 text-emerald-500 accent-emerald-500 focus:ring-emerald-500"
              checked={checked}
              onChange={(e) => onCheckedChange(e.target.checked)}
            />
            <span className="text-xs font-semibold leading-snug text-slate-200">
              I have read this carefully and choose to proceed, understanding the impact on my own learning.
            </span>
          </label>

          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800/80">
            <button
              type="button"
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
              onClick={onDismiss}
            >
              Cancel
            </button>

            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all"
              disabled={!checked}
              onClick={onAgree}
            >
              <span>I Agree &amp; Proceed</span>
              <i className="ti ti-arrow-right text-xs" aria-hidden="true" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
