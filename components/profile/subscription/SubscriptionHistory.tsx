"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt, Check, RefreshCw, ArrowLeft, Download, Gift, Sparkles } from "lucide-react";
import type { Profile } from "@/hooks/useAuth";
import type { SubViewId } from "./StudentSubscriptionHub";
import type { BillingRecord, BillingRecordStatus } from "./types";
import { buildBillingHistoryFromProfile } from "@/lib/subscription/billingHistoryFromProfile";
import { fetchRdmConfig } from "@/lib/rdm/rdmConfig";

interface Props {
  profile: Profile;
  onNavigate: (view: SubViewId) => void;
}

const STATUS_STYLES: Record<BillingRecordStatus, string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  refunded: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  cancelled: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  activated: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  bonus: "border-violet-500/30 bg-violet-500/10 text-violet-300",
};

const STATUS_ICONS: Record<BillingRecordStatus, typeof Check> = {
  paid: Check,
  refunded: RefreshCw,
  cancelled: ArrowLeft,
  activated: Sparkles,
  bonus: Gift,
};

const STATUS_LABELS: Record<BillingRecordStatus, string> = {
  paid: "paid",
  refunded: "refunded",
  cancelled: "cancelled",
  activated: "activated",
  bonus: "free bonus",
};

function formatAmount(record: BillingRecord): string {
  if (record.status === "activated" || record.status === "bonus") return "Free";
  if (record.amount === 0) return "—";
  if (record.amount < 0) return `-₹${Math.abs(record.amount).toLocaleString()}`;
  return `₹${record.amount.toLocaleString()}`;
}

function rowIconClass(status: BillingRecordStatus): string {
  if (status === "paid") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";
  if (status === "refunded") return "border-rose-500/20 bg-rose-500/10 text-rose-400";
  if (status === "cancelled") return "border-orange-500/20 bg-orange-500/10 text-orange-400";
  if (status === "bonus") return "border-violet-500/20 bg-violet-500/10 text-violet-400";
  return "border-sky-500/20 bg-sky-500/10 text-sky-400";
}

export default function SubscriptionHistory({ profile }: Props) {
  const [welcomeRdm, setWelcomeRdm] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchRdmConfig().then((cfg) => {
      if (!cancelled) setWelcomeRdm(cfg.free_trial_welcome_rdm);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const billingRecords = useMemo(
    () => buildBillingHistoryFromProfile(profile, { welcomeRdm }),
    [profile, welcomeRdm]
  );

  const handleDownloadInvoice = (invId: string) => {
    alert(`Downloading invoice ${invId}...`);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2.5">
          <Receipt className="h-4.5 w-4.5 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide text-white">Billing History</span>
        </div>
        {billingRecords.some((r) => r.status === "paid") && (
          <button
            onClick={() => handleDownloadInvoice("all")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Download className="h-3 w-3" />
            Export All
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col divide-y divide-white/[0.04]">
        {billingRecords.length === 0 ? (
          <div className="py-8 text-center">
            <Receipt className="mx-auto h-8 w-8 text-slate-600 mb-2 opacity-55" />
            <p className="text-xs font-semibold text-slate-400">
              No invoices or billing history found.
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Activate your free trial or claim a bonus to see entries here.
            </p>
          </div>
        ) : (
          billingRecords.map((record) => {
            const StatusIcon = STATUS_ICONS[record.status] ?? Check;
            const showInvoice = record.status === "paid";
            return (
              <div key={record.id} className="flex items-center gap-3.5 py-4 last:pb-0 first:pt-2">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${rowIconClass(record.status)}`}
                >
                  <StatusIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white">{record.title}</p>
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                    {record.date} · {record.method}
                    {record.txnId ? ` · ${record.txnId}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${STATUS_STYLES[record.status]}`}
                >
                  {STATUS_LABELS[record.status]}
                </span>
                <span
                  className={`text-sm font-bold whitespace-nowrap px-2 ${
                    record.status === "refunded"
                      ? "text-rose-400"
                      : record.status === "cancelled"
                        ? "text-slate-500"
                        : record.status === "paid"
                          ? "text-white"
                          : "text-sky-300"
                  }`}
                >
                  {formatAmount(record)}
                </span>
                {showInvoice ? (
                  <button
                    onClick={() => handleDownloadInvoice(record.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Download className="h-3 w-3" />
                    Invoice
                  </button>
                ) : (
                  <span className="w-[72px] shrink-0" aria-hidden />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
