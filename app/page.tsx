"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import EduBlastInvestorLanding from "@/components/landing/EduBlastInvestorLanding";
import { INVESTOR_NAV_LINKS } from "@/components/landing/landing-constants";

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#050505]">
          <span className="w-8 h-8 rounded-[9px] bg-[#34f5a4] flex items-center justify-center text-neutral-950 text-[15px] font-medium animate-pulse">
            E
          </span>
        </div>
      }
    >
      <LandingPageContent />
    </Suspense>
  );
}

function LandingPageContent() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && profile?.onboarding_complete) router.replace("/home");
  }, [user, profile?.onboarding_complete, loading, router]);

  return (
    <div className="landing-page min-h-screen scroll-smooth bg-[#050505] text-zinc-100">
      <LandingNavbar variant="dark" navLinks={INVESTOR_NAV_LINKS} />
      <EduBlastInvestorLanding />
      <LandingFooter variant="dark" />
    </div>
  );
}
