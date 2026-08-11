import { cn } from "@/lib/utils";

type PlanPriceDisplayProps = {
  /** Current / sale monthly price in rupees. 0 → free. */
  priceMonthly: number;
  /** Optional list price shown struck through (e.g. 999 for Starter). */
  priceOriginalMonthly?: number;
  /** When true, show "Coming soon" instead of prices. */
  annualComingSoon?: boolean;
  /** Accent for "/month" — starter blue / pro purple / default slate. */
  accent?: "starter" | "pro" | "default";
  className?: string;
};

function formatRs(amount: number): string {
  return `Rs ${amount.toLocaleString("en-IN")}`;
}

/** E-commerce style red diagonal cut through MRP — solid bright red, not washed grey. */
function RedPriceSlash() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-[-4px] inset-y-[-2px] h-[calc(100%+4px)] w-[calc(100%+8px)]"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1="2"
        y1="20"
        x2="98"
        y2="4"
        stroke="#FF2D2D"
        strokeWidth="3.25"
        strokeLinecap="round"
      />
      <line
        x1="2"
        y1="20"
        x2="98"
        y2="4"
        stroke="#FF6B6B"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function PlanPriceDisplay({
  priceMonthly,
  priceOriginalMonthly,
  annualComingSoon = false,
  accent = "default",
  className,
}: PlanPriceDisplayProps) {
  if (annualComingSoon) {
    return (
      <span className={cn("text-2xl font-extrabold tracking-tight text-white", className)}>
        Coming soon
      </span>
    );
  }

  const periodClass =
    accent === "starter"
      ? "text-blue-300"
      : accent === "pro"
        ? "text-purple-300"
        : "text-slate-300";

  const hasStrike =
    typeof priceOriginalMonthly === "number" &&
    priceOriginalMonthly > priceMonthly &&
    priceMonthly > 0;

  const saveAmount = hasStrike ? priceOriginalMonthly! - priceMonthly : 0;
  const discountPercent = hasStrike
    ? Math.round((saveAmount / priceOriginalMonthly!) * 100)
    : 0;

  if (priceMonthly <= 0) {
    return (
      <span className={cn("flex items-baseline gap-1.5", className)}>
        <span className="text-3xl font-extrabold tracking-tight text-white">Rs 0</span>
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {hasStrike ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
              MRP
            </span>
            <span
              className="relative inline-flex items-center px-0.5 text-[1.35rem] font-black leading-none tracking-tight text-white/90"
              aria-label={`Was ${formatRs(priceOriginalMonthly!)}`}
            >
              {formatRs(priceOriginalMonthly!)}
              <RedPriceSlash />
            </span>
          </span>
          <span className="rounded-md bg-[#FF2D2D] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_16px_rgba(255,45,45,0.35)]">
            {discountPercent}% OFF
          </span>
        </div>
      ) : null}

      <div className="flex items-baseline gap-2">
        <span className="text-[2.35rem] font-black leading-none tracking-[-0.045em] text-white">
          {formatRs(priceMonthly)}
        </span>
        <span className={cn("text-sm font-bold", periodClass)}>/month</span>
      </div>

      {hasStrike ? (
        <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-wide text-emerald-400">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-500/20 text-[10px] text-emerald-300">
            ↓
          </span>
          <span>You save {formatRs(saveAmount)} every month</span>
        </div>
      ) : null}
    </div>
  );
}
