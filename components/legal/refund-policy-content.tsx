"use client";

import Link from "next/link";

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-7 border-t border-white/10 pt-5 text-lg font-medium first:mt-0 first:border-t-0 first:pt-0"
    >
      {children}
    </h2>
  );
}

export function RefundPolicyContent() {
  return (
    <>
      <div className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-medium">Refund Policy</h1>
        <div className="mt-1.5 flex flex-wrap gap-3.5 text-[11px] text-white/30">
          <span className="flex items-center gap-1">
            <i className="ti ti-calendar text-[13px]" />
            Effective: 14 May 2026
          </span>
          <span className="flex items-center gap-1">
            <i className="ti ti-map-pin text-[13px]" />
            Jurisdiction: India
          </span>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-white/50">
        This Refund Policy is published by EduBlast Technologies Private Limited
        (&quot;EduBlast&quot;, &quot;we&quot;) for paid subscriptions on the EduBlast website and
        app. It is a public page. You do not need an account to read it. It states the same refund
        rules as section 7 of the{" "}
        <Link href="/terms-conditions/terms-and-conditions" className="text-[#9FE1CB] underline">
          Terms and Conditions
        </Link>
        . How to stop a plan is in the{" "}
        <Link href="/terms-conditions/cancellation-policy" className="text-[#9FE1CB] underline">
          Cancellation Policy
        </Link>
        .
      </p>

      <SectionHeading id="refund-1">1. What this covers</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          Paid subscription plans (Scholar and Champion). Prices and features are those shown on the
          subscription page at the time of purchase.
        </li>
        <li>
          Payments are taken by Razorpay. EduBlast does not store card or UPI details.
        </li>
        <li>The free tier has no subscription charge, so there is nothing to refund.</li>
        <li>
          Teacher RDM packs bought with rupees through Razorpay. Those credits are a purchase. RDM
          earned from students, classes, or other activity is not a purchase.
        </li>
        <li>Amounts are in Indian Rupees. GST is charged at the applicable rate.</li>
      </ul>

      <SectionHeading id="refund-2">2. Annual subscriptions</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        A full refund is available within 7 calendar days of an annual subscription renewal, if no
        more than 10% of that subscription period has been used. Outside that window, the annual
        fee is not refunded and is not reduced for unused days.
      </p>

      <SectionHeading id="refund-3">3. Monthly subscriptions</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        Monthly subscriptions are non-refundable. Stopping auto-renewal keeps access until the end
        of the month already paid for, and does not return that month&apos;s fee.
      </p>

      <SectionHeading id="refund-4">4. How to ask for a refund</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        Email billing@edublast.in from the address on the EduBlast account. Include the account
        email, the payment date, and the Razorpay payment or order reference if you have it.
        EduBlast will reply to eligible requests and process an approved refund back through
        Razorpay to the original payment method.
      </p>

      <SectionHeading id="refund-5">5. Teacher RDM packs</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        A teacher can buy an RDM pack in the teacher portal. Razorpay collects the rupees, and
        EduBlast adds only that pack&apos;s RDM to the wallet. A refund is available from the
        purchase list on that same page, and only while every RDM from that pack is still unused.
        Spending uses purchased RDM before RDM earned from students or tasks. Once any credit from
        that pack is spent, the payment is not refunded and is not reduced for the unused part.
        An approved refund returns the pack price through Razorpay to the original payment method
        and removes that pack&apos;s RDM. RDM earned from activity is never turned into a cash
        refund.
      </p>

      <SectionHeading id="refund-6">6. What is not refunded</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>A monthly subscription fee.</li>
        <li>An annual fee after the 7-day window, or after more than 10% of the period is used.</li>
        <li>The current period when auto-renewal is turned off.</li>
        <li>RDM earned from students, classes, quizzes, or other activity. That RDM was not paid for.</li>
        <li>A teacher RDM pack after any of its credits have been used.</li>
        <li>Edufundz grants or other rewards.</li>
      </ul>

      <SectionHeading id="refund-7">7. Price changes</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        EduBlast may change subscription prices with 30 days&apos; notice. A change applies at the
        next renewal for an existing subscriber. It does not by itself create a refund of a period
        already paid.
      </p>
    </>
  );
}
