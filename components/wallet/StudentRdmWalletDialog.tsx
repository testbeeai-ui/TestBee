"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins, X } from "lucide-react";
import RdmWalletBalanceStrip from "@/components/wallet/RdmWalletBalanceStrip";
import RdmWalletBreakdown from "@/components/wallet/RdmWalletBreakdown";
import { fetchRdmConfig, type RdmConfigParams } from "@/lib/rdm/rdmConfig";
import { buildStudentWalletGuide } from "@/lib/rdm/studentWalletGuide";

type Props = {
  open: boolean;
  onClose: () => void;
  balance: number;
};

export default function StudentRdmWalletDialog({ open, onClose, balance }: Props) {
  const [config, setConfig] = useState<RdmConfigParams | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchRdmConfig()
      .then((cfg) => {
        if (!cancelled) setConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const guide = useMemo(
    () => buildStudentWalletGuide({ config: config ?? undefined }),
    [config]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,760px)] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl md:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="RDM Wallet"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">RDM Wallet</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close wallet"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <RdmWalletBalanceStrip balance={balance} variant="light" />

          <div className="mt-4">
            <RdmWalletBreakdown guide={guide} compact popup variant="light" />
          </div>

          <div className="mt-4 border-t border-border/60 pt-3">
            <Link
              href="/profile?section=activity"
              onClick={onClose}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View activity history →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
