"use client";

import type { Profile } from "@/hooks/useAuth";
import type { StudentProfileSectionId } from "../StudentProfileShell";
import SubscriptionOverview from "./SubscriptionOverview";
import SubscriptionPlans from "./SubscriptionPlans";
import SubscriptionPayment from "./SubscriptionPayment";
import SubscriptionCheckout from "./SubscriptionCheckout";
import SubscriptionHistory from "./SubscriptionHistory";
import SubscriptionCancel from "./SubscriptionCancel";
import SubscriptionCoupon from "./SubscriptionCoupon";

export type SubViewId =
  | "overview"
  | "plans"
  | "payment"
  | "checkout"
  | "coupon"
  | "history"
  | "cancel";

interface Props {
  profile: Profile;
  activeView: SubViewId;
  onSectionChange?: (id: StudentProfileSectionId) => void;
}

export default function StudentSubscriptionHub({ profile, activeView, onSectionChange }: Props) {
  const navigate = (view: SubViewId) => {
    onSectionChange?.(`sub-${view}` as StudentProfileSectionId);
  };

  switch (activeView) {
    case "overview":
      return <SubscriptionOverview profile={profile} onNavigate={navigate} />;
    case "plans":
      return <SubscriptionPlans profile={profile} onNavigate={navigate} />;
    case "payment":
      return <SubscriptionPayment profile={profile} onNavigate={navigate} />;
    case "checkout":
      return <SubscriptionCheckout profile={profile} onNavigate={navigate} />;
    case "coupon":
      return <SubscriptionCoupon profile={profile} />;
    case "history":
      return <SubscriptionHistory profile={profile} onNavigate={navigate} />;
    case "cancel":
      return <SubscriptionCancel profile={profile} onNavigate={navigate} />;
  }
}
