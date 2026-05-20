"use client";

import type { Profile } from "@/hooks/useAuth";
import type { StudentProfileSectionId } from "../StudentProfileShell";
import SubscriptionOverview from "./SubscriptionOverview";
import SubscriptionPlans from "./SubscriptionPlans";
import SubscriptionPayment from "./SubscriptionPayment";
import SubscriptionCheckout from "./SubscriptionCheckout";
import SubscriptionHistory from "./SubscriptionHistory";
import SubscriptionCancel from "./SubscriptionCancel";

export type SubViewId = "overview" | "plans" | "payment" | "checkout" | "history" | "cancel";

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
      return <SubscriptionOverview onNavigate={navigate} />;
    case "plans":
      return <SubscriptionPlans onNavigate={navigate} />;
    case "payment":
      return <SubscriptionPayment onNavigate={navigate} />;
    case "checkout":
      return <SubscriptionCheckout />;
    case "history":
      return <SubscriptionHistory />;
    case "cancel":
      return <SubscriptionCancel onNavigate={navigate} />;
  }
}
