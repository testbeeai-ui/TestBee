"use client";

import { Receipt, Check, RefreshCw, ArrowLeft, Download } from "lucide-react";
import { MOCK_BILLING } from "./types";

const STATUS_STYLES: Record<string, string> = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  refunded: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  cancelled: "border-orange-500/30 bg-orange-500/10 text-orange-300",
};

const STATUS_ICONS: Record<string, typeof Check> = {
  paid: Check,
  refunded: RefreshCw,
  cancelled: ArrowLeft,
};

export default function SubscriptionHistory() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0c1224] to-[#080d1a] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2.5">
          <Receipt className="h-4.5 w-4.5 text-emerald-400" />
          <span className="text-sm font-bold tracking-wide text-white">Billing History</span>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
          <Download className="h-3 w-3" />
          Export All
        </button>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-white/[0.04]">
        {MOCK_BILLING.length === 0 ? (
          <div className="py-8 text-center">
            <Receipt className="mx-auto h-8 w-8 text-slate-600 mb-2 opacity-55" />
            <p className="text-xs font-semibold text-slate-400">
              No invoices or billing history found.
            </p>
          </div>
        ) : (
          MOCK_BILLING.map((record) => {
            const StatusIcon = STATUS_ICONS[record.status] ?? Check;
            return (
              <div key={record.id} className="flex items-center gap-3.5 py-4 last:pb-0 first:pt-2">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                    record.status === "paid"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : record.status === "refunded"
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                        : "border-orange-500/20 bg-orange-500/10 text-orange-400"
                  }`}
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
                  {record.status}
                </span>
                <span
                  className={`text-sm font-bold whitespace-nowrap px-2 ${
                    record.status === "refunded"
                      ? "text-rose-400"
                      : record.status === "cancelled"
                        ? "text-slate-500"
                        : "text-white"
                  }`}
                >
                  {record.amount === 0
                    ? "—"
                    : record.amount < 0
                      ? `-₹${Math.abs(record.amount).toLocaleString()}`
                      : `₹${record.amount.toLocaleString()}`}
                </span>
                <button className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
                  <Download className="h-3 w-3" />
                  Invoice
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
