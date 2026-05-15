"use client";

import type { ReactNode } from "react";
import AppLayout from "@/components/AppLayout";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { INVESTOR_NAV_LINKS } from "@/components/landing/landing-constants";

export function PublicShell({
  isLoggedIn,
  children,
}: {
  isLoggedIn: boolean;
  children: ReactNode;
}) {
  if (isLoggedIn) {
    return <AppLayout wideMain>{children}</AppLayout>;
  }

  return (
    <div className="landing-page min-h-screen scroll-smooth bg-[#050505] text-zinc-100">
      <LandingNavbar variant="dark" navLinks={INVESTOR_NAV_LINKS} />
      <main className="mx-auto w-full max-w-[min(100%,1500px)] px-3 py-4 sm:px-5 sm:py-6">
        {children}
      </main>
      <LandingFooter variant="dark" />
    </div>
  );
}
