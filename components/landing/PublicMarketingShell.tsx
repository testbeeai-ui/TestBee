"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import LandingNavbar from "@/components/landing/LandingNavbar";
import { INVESTOR_NAV_LINKS } from "@/components/landing/landing-constants";
import { useAuth } from "@/hooks/useAuth";

const AppLayout = dynamic(() => import("@/components/AppLayout"));

export type MarketingShellContext = {
  isInAppShell: boolean;
};

export function MarketingPageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#0E1117] text-sm text-[#8B96A5]">
      Loading…
    </div>
  );
}

export function PublicMarketingShell({
  children,
}: {
  children: (ctx: MarketingShellContext) => ReactNode;
}) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <MarketingPageFallback />;
  }

  const isInAppShell = Boolean(user && profile?.onboarding_complete);
  const body = children({ isInAppShell });

  if (isInAppShell) {
    return <AppLayout>{body}</AppLayout>;
  }

  return (
    <div className="min-h-screen bg-[#0E1117] text-[#EAEFF5]">
      <LandingNavbar variant="dark" navLinks={INVESTOR_NAV_LINKS} />
      {body}
    </div>
  );
}
