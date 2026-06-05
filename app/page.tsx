"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import EduBlastInvestorLanding from "@/components/landing/EduBlastInvestorLanding";
import SignInNoticeModal from "@/components/landing/SignInNoticeModal";
import { INVESTOR_NAV_LINKS } from "@/components/landing/landing-constants";
import {
  getSafeInternalNextPath,
  persistPendingDeepLink,
  clearPendingDeepLink,
} from "@/lib/auth/safeNextPath";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";

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
  const searchParams = useSearchParams();
  const [noticeOpen, setNoticeOpen] = useState(false);
  // Depend on the string, not the searchParams object (identity can churn and retrigger the effect).
  const nextParam = searchParams.get("next");
  const safeNextFromUrl = getSafeInternalNextPath(nextParam);

  useEffect(() => {
    if (safeNextFromUrl) persistPendingDeepLink(safeNextFromUrl);
  }, [safeNextFromUrl]);

  useEffect(() => {
    if (loading) return;
    if (user && profile?.onboarding_complete) {
      if (safeNextFromUrl) {
        clearPendingDeepLink();
        router.replace(safeNextFromUrl);
        return;
      }
      router.replace(profile?.role === "teacher" ? TEACHER_PORTAL_CLASSROOMS_URL : "/home");
    }
  }, [user, profile?.onboarding_complete, profile?.role, loading, router, safeNextFromUrl]);

  return (
    <div className="landing-page min-h-screen scroll-smooth bg-[#050505] text-zinc-100">
      <LandingNavbar 
        variant="dark" 
        navLinks={INVESTOR_NAV_LINKS} 
        sharedNext={safeNextFromUrl} 
        onOpenWaitlist={(role) => router.push(role ? `/waitlist?role=${role}` : "/waitlist")}
        onOpenSignInNotice={() => setNoticeOpen(true)}
      />
      <EduBlastInvestorLanding onOpenWaitlist={(role) => router.push(role ? `/waitlist?role=${role}` : "/waitlist")} />
      <LandingFooter variant="dark" />

      <SignInNoticeModal
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        onJoinWaitlist={() => router.push("/waitlist")}
      />
    </div>
  );
}
