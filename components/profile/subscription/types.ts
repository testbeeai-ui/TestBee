export type SubscriptionViewId =
  | "overview"
  | "plans"
  | "payment"
  | "checkout"
  | "history"
  | "cancel";

export interface PlanTier {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  missing: string[];
  badge?: string;
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "Gyan++ AI wall — unlimited",
      "DailyDose — 5 Qs daily",
      "Social feed + leaderboard",
      "Basic Instacue (20 cards)",
    ],
    missing: ["Testbee adaptive mocks", "Live classes"],
  },
  {
    id: "scholar",
    name: "Scholar",
    priceMonthly: 499,
    priceYearly: 3999,
    features: [
      "Everything in Free",
      "Testbee — unlimited mocks",
      "Full Instacue library",
      "Live + recorded classes",
      "AI Calendar planner",
      "EduFund Scholar eligibility",
    ],
    missing: [],
  },
  {
    id: "champion",
    name: "Champion",
    priceMonthly: 899,
    priceYearly: 6999,
    features: [
      "Everything in Scholar",
      "Mentor booking — IIT alumni",
      "Priority Gyan++ routing",
      "Personal EduFund advisor",
      "Parent dashboard — full",
      "Champion tier grant eligibility",
    ],
    missing: [],
    badge: "Most powerful",
  },
];

export interface BillingRecord {
  id: string;
  title: string;
  date: string;
  method: string;
  txnId: string;
  amount: number;
  status: "paid" | "refunded" | "cancelled";
}

export const MOCK_BILLING: BillingRecord[] = [
  { id: "1", title: "Scholar plan — annual renewal", date: "14 May 2026", method: "UPI — rahul@paytm", txnId: "TXN#RZP2026051412", amount: 3999, status: "paid" },
  { id: "2", title: "Scholar plan — annual renewal", date: "14 May 2025", method: "Visa •••• 4242", txnId: "TXN#RZP2025051407", amount: 3999, status: "paid" },
  { id: "3", title: "Free to Scholar upgrade", date: "14 May 2024", method: "Net banking HDFC", txnId: "TXN#RZP2024051401", amount: 499, status: "paid" },
  { id: "4", title: "Refund — Champion plan (within 7 days)", date: "03 Apr 2024", method: "Refunded to UPI", txnId: "TXN#REF2024040301", amount: -6999, status: "refunded" },
  { id: "5", title: "Scholar plan — cancelled mid-term", date: "28 Mar 2024", method: "Subscription ended early", txnId: "", amount: 0, status: "cancelled" },
];
