"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import ProblemSection from "@/components/landing/ProblemSection";
import PersonaSection from "@/components/landing/PersonaSection";
import FeatureTableSection from "@/components/landing/FeatureTableSection";
import CoreEngineSection from "@/components/landing/CoreEngineSection";
import PricingSection from "@/components/landing/PricingSection";
import FinalCtaSection from "@/components/landing/FinalCtaSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <span className="w-8 h-8 rounded-[9px] bg-[#1D9E75] flex items-center justify-center text-white text-[15px] font-medium animate-pulse">
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
    <div className="landing-page min-h-screen bg-white scroll-smooth">
      <LandingNavbar />
      <HeroSection />
      <ProblemSection />
      <PersonaSection />
      <FeatureTableSection />
      <CoreEngineSection />
      <PricingSection />
      <FinalCtaSection />
      <LandingFooter />
    </div>
  );
}
