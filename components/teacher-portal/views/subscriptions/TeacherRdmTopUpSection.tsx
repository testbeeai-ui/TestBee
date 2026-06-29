"use client";

import { Check, Coins, Sparkles } from "lucide-react";
import RazorpayCheckoutButton from "@/components/payments/RazorpayCheckoutButton";
import { useToast } from "@/hooks/use-toast";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import {
  TEACHER_RDM_PACKS,
  type TeacherRdmPackId,
} from "@/lib/subscription/teacherRdmPacks";

type Props = {
  onCreditsAdded: (newBalance: number) => Promise<void>;
};

export function TeacherRdmTopUpSection({ onCreditsAdded }: Props) {
  const { toast } = useToast();

  const handlePackPaymentVerified = async (
    packId: TeacherRdmPackId,
    response: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  ) => {
    const purchaseRes = await fetchWithClientAuth("/api/user/coupons/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId, ...response }),
    });
    const purchaseBody = (await purchaseRes.json()) as {
      error?: string;
      code?: string;
      rdmAmount?: number;
      newBalance?: number;
    };
    if (!purchaseRes.ok) {
      throw new Error(purchaseBody.error || "Purchase failed");
    }

    if (typeof purchaseBody.newBalance !== "number") {
      throw new Error("Payment succeeded but wallet balance could not be confirmed.");
    }

    await onCreditsAdded(purchaseBody.newBalance);
    toast({
      title: "RDM credited",
      description: `+${purchaseBody.rdmAmount?.toLocaleString("en-IN") ?? ""} RDM · balance ${purchaseBody.newBalance.toLocaleString("en-IN")}`,
    });
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-b from-amber-950/25 via-[#0b0e16] to-slate-950/90 shadow-2xl shadow-amber-950/15">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative border-b border-white/[0.06] px-5 py-5 md:px-7 md:py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/15">
            <Coins className="h-4 w-4 text-amber-300" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white md:text-xl">RDM top-up</h2>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-400 md:text-sm">
              Buy RDM credits for classroom actions, live classes, and assignments. Pay instantly
              via Razorpay — UPI, cards, or wallets.
            </p>
          </div>
        </div>
      </div>

      <div className="relative grid gap-4 p-5 md:grid-cols-3 md:p-7 md:pt-6">
        {TEACHER_RDM_PACKS.map((pack) => {
          const isRecommended = pack.recommended === true;

          return (
            <article
              key={pack.id}
              className={`relative flex min-h-[280px] flex-col rounded-2xl border p-5 transition ${
                isRecommended
                  ? "border-amber-400/35 bg-amber-500/[0.05] shadow-lg shadow-amber-900/20"
                  : "border-white/10 bg-white/[0.02] hover:border-white/15"
              }`}
            >
              {isRecommended ? (
                <span className="absolute -top-2.5 left-4 flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                  <Sparkles className="h-3 w-3" />
                  Best value
                </span>
              ) : null}

              <header className="mb-4 pt-1 text-center">
                <p className="font-serif text-3xl font-extrabold tracking-tight text-amber-300">
                  {pack.rdm.toLocaleString("en-IN")}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  RDM credits
                </p>
              </header>

              <div className="mb-5 border-b border-white/[0.06] pb-4 text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-mono text-2xl font-extrabold tracking-tight text-white">
                    ₹{pack.priceInr.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs font-medium text-slate-500">one-time</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  ≈ ₹{(pack.priceInr / pack.rdm).toFixed(2)} per RDM
                </p>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                <li className="flex gap-2 text-[11px] leading-snug text-slate-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Credits your wallet instantly after payment</span>
                </li>
                <li className="flex gap-2 text-[11px] leading-snug text-slate-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Use for classrooms, assignments, and live sessions</span>
                </li>
              </ul>

              <div className="mt-auto">
                <RazorpayCheckoutButton
                  amount={pack.amountPaise}
                  label={`Buy — ₹${pack.priceInr.toLocaleString("en-IN")}`}
                  description={`${pack.rdm.toLocaleString("en-IN")} RDM top-up`}
                  createOrderBody={{
                    purpose: "rdm_pack",
                    packId: pack.id,
                  }}
                  onPaymentVerified={async (r) => handlePackPaymentVerified(pack.id, r)}
                  showLockIcon={false}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-3 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-60"
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
