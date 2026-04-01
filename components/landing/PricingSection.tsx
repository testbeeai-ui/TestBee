import Link from "next/link";
import { PRICING_PLANS } from "./landing-constants";

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-gray-50 px-5 md:px-10 py-10 border-b border-gray-200/60">
      <div className="max-w-[1200px] mx-auto">
        <p className="text-xs font-medium tracking-[0.06em] text-gray-400 uppercase mb-[6px]">
          Pricing
        </p>
        <h2 className="text-xl md:text-[26px] font-medium text-gray-900 leading-[1.3] mb-7">
          Start free. Upgrade when you want more.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`bg-white rounded-xl p-[18px] text-center ${
                plan.featured
                  ? "border-2 border-[#1D9E75]"
                  : "border border-gray-200/60"
              }`}
            >
              {plan.badge && (
                <span className="inline-block text-xs font-medium text-[#085041] bg-[#E1F5EE] px-[10px] py-[3px] rounded-full mb-2">
                  {plan.badge}
                </span>
              )}
              <div className="text-sm font-medium text-gray-900 mb-1">{plan.name}</div>
              <div className="text-3xl font-medium text-gray-900 mb-[2px]">{plan.price}</div>
              <div className="text-xs text-gray-400 mb-[14px]">{plan.sub}</div>

              <div className="text-left text-sm text-gray-500 leading-[1.7] mb-[14px] space-y-[2px]">
                {plan.features.map((f) => (
                  <div key={f}>{f}</div>
                ))}
              </div>

              <Link
                href="/auth"
                className={`block w-full rounded-lg py-2 text-sm font-medium transition-colors ${
                  plan.variant === "green"
                    ? "bg-[#1D9E75] text-white hover:bg-[#178d68]"
                    : plan.variant === "coral"
                      ? "bg-[#D85A30] text-white hover:bg-[#c24f28]"
                      : "border border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-[14px] text-sm text-gray-400 text-center">
          All plans include RDM accumulation toward EduFund grants. Eligible students can offset
          their subscription cost entirely through financial aid.
        </p>
      </div>
    </section>
  );
}
