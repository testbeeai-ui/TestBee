"use client";

import type { WalletGuide } from "@/lib/rdm/walletGuideTypes";
import RdmWalletBreakdown from "@/components/wallet/RdmWalletBreakdown";

type Props = {
  guide: WalletGuide;
  /** Tighter rows for header popup. */
  compact?: boolean;
  popup?: boolean;
};

export default function TeacherWalletBreakdown({ guide, compact = false, popup = false }: Props) {
  return (
    <RdmWalletBreakdown guide={guide} compact={compact} popup={popup} variant="dark" />
  );
}
