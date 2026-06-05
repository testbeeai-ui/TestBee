export type SubscriptionViewId =
  | "overview"
  | "plans"
  | "payment"
  | "checkout"
  | "history"
  | "cancel";

export interface FeatureItem {
  name: string;
  checked: boolean;
  badge?: string;
}

export interface FeatureCategory {
  title: string;
  items: FeatureItem[];
}

export interface PlanTier {
  id: "free_trial" | "free" | "starter" | "pro";
  name: string;
  priceMonthly: number;
  priceYearly: number;
  description: string;
  badge?: string;
  highlights: string[];
  categories: FeatureCategory[];
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "free_trial",
    name: "Free Trial",
    priceMonthly: 0,
    priceYearly: 0,
    description: "14-day guided onboarding plan with focused practice limits.",
    badge: "Trial",
    highlights: ["Magic Wall: 3/month", "1 doubt/day", "3 mocks/month", "DailyDose 5/day"],
    categories: [
      {
        title: "Dashboard & Social",
        items: [
          { name: "Magic Wall - monthly attempts", checked: true, badge: "Trial 3 / Free 2" },
          { name: "Gyan++ doubts", checked: true, badge: "1/day" },
          { name: "Leaderboard", checked: true },
          { name: "Learning buddy matching", checked: false },
        ],
      },
      {
        title: "Lessons & Revision",
        items: [
          { name: "Lessons", checked: true, badge: "2/subject" },
          { name: "InstaCue cards", checked: true, badge: "20 cards" },
          { name: "Spaced repetition scheduler", checked: false, badge: "coming soon" },
          { name: "Performance dashboard", checked: true, badge: "basic" },
          { name: "Category performance report", checked: false },
        ],
      },
      {
        title: "Prep + Mock Tests",
        items: [
          { name: "Testbee mocks", checked: true, badge: "3/month" },
          { name: "Adaptive difficulty", checked: false, badge: "coming soon" },
          { name: "AI calendar", checked: true, badge: "basic" },
        ],
      },
      {
        title: "Earn & Learn",
        items: [
          { name: "DailyDose", checked: true, badge: "5/day" },
          { name: "MentalMill challenge", checked: true },
          { name: "Quant Blitz + Logic Maze", checked: false },
          { name: "RDM accumulation", checked: true, badge: "0.25x rate" },
        ],
      },
      {
        title: "EduFund & Profile",
        items: [
          { name: "EduFund preview", checked: true },
          { name: "EduFund application access", checked: false },
          { name: "News & blog", checked: true, badge: "full access" },
        ],
      },
    ],
  },
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    description: "Always-available free tier. Note: mock test access is limited to a total of 6 tests (2 months cap).",
    highlights: ["Magic Wall 2/month", "1 doubt/day", "3 mocks/month (max 6 total)", "DailyDose 5/day"],
    categories: [
      {
        title: "Dashboard & Social",
        items: [
          { name: "Magic Wall - monthly attempts", checked: true, badge: "2/month" },
          { name: "Gyan++ doubts", checked: true, badge: "1/day" },
          { name: "Leaderboard", checked: true },
          { name: "Learning buddy matching", checked: false },
        ],
      },
      {
        title: "Lessons & Revision",
        items: [
          { name: "Lessons", checked: true, badge: "2/subject" },
          { name: "InstaCue cards", checked: true, badge: "20 cards" },
          { name: "Spaced repetition scheduler", checked: false, badge: "coming soon" },
          { name: "Performance dashboard", checked: true, badge: "basic" },
          { name: "Category performance report", checked: false },
        ],
      },
      {
        title: "Prep + Mock Tests",
        items: [
          { name: "Testbee mocks", checked: true, badge: "3/month (2 months cap / 6 max)" },
          { name: "Adaptive difficulty", checked: false, badge: "coming soon" },
          { name: "AI calendar", checked: true, badge: "basic" },
        ],
      },
      {
        title: "Earn & Learn",
        items: [
          { name: "DailyDose", checked: true, badge: "5/day" },
          { name: "MentalMill challenge", checked: true },
          { name: "Quant Blitz + Logic Maze", checked: false },
          { name: "RDM accumulation", checked: true, badge: "0.25x rate" },
        ],
      },
      {
        title: "EduFund & Profile",
        items: [
          { name: "EduFund preview", checked: true },
          { name: "EduFund application access", checked: false },
          { name: "News & blog", checked: true, badge: "full access" },
        ],
      },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 499,
    priceYearly: 0,
    description: "Expanded practice limits for consistent aspirants.",
    badge: "Most popular",
    highlights: ["30 doubts/day", "200 InstaCue cards", "8 mocks/month", "DailyDose 10/day"],
    categories: [
      {
        title: "Dashboard & Social",
        items: [
          { name: "Everything in Free tier", checked: true },
          { name: "Gyan++ doubts", checked: true, badge: "30/day" },
          { name: "Leaderboard", checked: true, badge: "full rank" },
          { name: "Learning buddy matching", checked: true },
        ],
      },
      {
        title: "Lessons & Revision",
        items: [
          { name: "Lessons", checked: true, badge: "all chapters" },
          { name: "InstaCue cards", checked: true, badge: "200 cards" },
          { name: "Spaced repetition scheduler", checked: true },
          { name: "Performance dashboard", checked: true, badge: "expanded" },
          { name: "Category performance report", checked: false },
        ],
      },
      {
        title: "Prep + Mock Tests",
        items: [
          { name: "Testbee mocks", checked: true, badge: "8/month" },
          { name: "Adaptive difficulty", checked: true },
          { name: "Recorded classes", checked: true, badge: "10 hrs/mo" },
          { name: "AI calendar", checked: true, badge: "basic" },
        ],
      },
      {
        title: "Earn & Learn",
        items: [
          { name: "DailyDose", checked: true, badge: "10/day" },
          { name: "Quant Blitz + Logic Maze", checked: true },
          { name: "Challenge test box", checked: true },
          { name: "RDM accumulation", checked: true, badge: "0.50x → 1.00x (loyalty)" },
        ],
      },
      {
        title: "EduFund & Profile",
        items: [
          { name: "EduFund scholar tiers", checked: true },
          { name: "Full activity track record", checked: true },
          { name: "News & blog", checked: true, badge: "full access" },
          { name: "Merit prize eligibility", checked: true },
        ],
      },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 899,
    priceYearly: 0,
    description: "Unlimited daily practice and full analytics tier.",
    badge: "Most powerful",
    highlights: ["Unlimited doubts", "Unlimited mocks", "DailyDose 10/day", "2x RDM"],
    categories: [
      {
        title: "Dashboard & Social",
        items: [
          { name: "Everything in Starter", checked: true },
          { name: "Gyan++ doubts", checked: true, badge: "unlimited" },
          { name: "Learning buddy matching", checked: true, badge: "unlimited" },
          { name: "Topper community access", checked: true },
        ],
      },
      {
        title: "Lessons & Revision",
        items: [
          { name: "InstaCue cards", checked: true, badge: "unlimited" },
          { name: "AI spaced repetition", checked: true },
          { name: "Subject-wise accuracy tracking", checked: true },
          { name: "Auto error notebook", checked: true },
        ],
      },
      {
        title: "Prep + Mock Tests",
        items: [
          { name: "Testbee mocks", checked: true, badge: "unlimited" },
          { name: "Category performance report", checked: true },
          { name: "Weak topic drill generator", checked: true },
          { name: "Recorded library", checked: true, badge: "unlimited" },
          { name: "AI calendar", checked: true, badge: "smart plan" },
        ],
      },
      {
        title: "Earn & Learn",
        items: [
          { name: "DailyDose", checked: true, badge: "10/day" },
          { name: "MentalMill", checked: true, badge: "all play modes" },
          { name: "RDM accumulation", checked: true, badge: "1.00x → 2.00x (loyalty)" },
          { name: "1-on-1 mentor sessions", checked: true, badge: "2/mo" },
        ],
      },
      {
        title: "EduFund & Profile",
        items: [
          { name: "EduFund all tiers", checked: true },
          { name: "NGO portfolio priority", checked: true },
          { name: "Merit prize + Ace Champ", checked: true },
          { name: "Priority guest lecture invites", checked: true },
        ],
      },
    ],
  },
];

export type BillingRecordStatus =
  | "paid"
  | "refunded"
  | "cancelled"
  | "activated"
  | "bonus";

export interface BillingRecord {
  id: string;
  title: string;
  date: string;
  method: string;
  txnId: string;
  amount: number;
  status: BillingRecordStatus;
}

export const MOCK_BILLING: BillingRecord[] = [];
