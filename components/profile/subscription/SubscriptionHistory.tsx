"use client";

import { Receipt, Check, RefreshCw, ArrowLeft, Download } from "lucide-react";
import { MOCK_BILLING } from "./types";

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400",
  refunded: "bg-rose-500/15 text-rose-400",
  cancelled: "bg-orange-500/15 text-orange-400",
};

const STATUS_ICONS: Record<string, typeof Check> = {
  paid: Check,
  refunded: RefreshCw,
  cancelled: ArrowLeft,
};

export default function SubscriptionHistory() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0c1017]">
      <div className="flex items-center justify-between border-b border-border pb-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground dark:text-white">Billing history</span>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5">
          <Download className="h-3 w-3" />
          Export all
        </button>
      </div>

      <div className="mt-3 flex flex-col">
        {MOCK_BILLING.map((record) => {
          const StatusIcon = STATUS_ICONS[record.status] ?? Check;
          return (
            <div
              key={record.id}
              className="flex items-center gap-3 border-b border-border py-3 last:border-b-0 dark:border-white/10"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                record.status === "paid" ? "bg-emerald-500/15" : record.status === "refunded" ? "bg-rose-500/15" : "bg-orange-500/15"
              }`}>
                <StatusIcon className={`h-4 w-4 ${
                  record.status === "paid" ? "text-emerald-400" : record.status === "refunded" ? "text-rose-400" : "text-orange-400"
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground dark:text-white">{record.title}</p>
                <p className="text-[11px] text-muted-foreground dark:text-slate-500">
                  {record.date} · {record.method}{record.txnId ? ` · ${record.txnId}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[record.status]}`}>
                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
              </span>
              <span className={`text-sm font-semibold whitespace-nowrap ${
                record.status === "refunded" ? "text-rose-400" : record.status === "cancelled" ? "text-muted-foreground dark:text-slate-500" : "text-foreground dark:text-white"
              }`}>
                {record.amount === 0 ? "—" : record.amount < 0 ? `-₹${Math.abs(record.amount).toLocaleString()}` : `₹${record.amount.toLocaleString()}`}
              </span>
              <button className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5">
                <Download className="h-3 w-3" />
                Invoice
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
