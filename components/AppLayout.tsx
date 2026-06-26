"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import {
  LayoutDashboard,
  Compass,
  Sparkles,
  User,
  Coins,
  Settings,
  HelpCircle,
  Heart,
  GraduationCap,
  Gift,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import StreakTimer from "@/components/StreakTimer";
import NotificationBell from "@/components/NotificationBell";
import BreakScreen from "@/components/BreakScreen";
import RecallExercise from "@/components/RecallExercise";
import { useStreakTimer } from "@/hooks/useStreakTimer";
import AgentOrchestratorRunner from "@/components/AgentOrchestratorRunner";
import { OnboardingRewardToastListener } from "@/components/onboarding/OnboardingRewardToastListener";
import { FloatingTaskCompanion } from "@/components/onboarding/FloatingTaskCompanion";
import { OnboardingNextTaskPrompt } from "@/components/onboarding/OnboardingNextTaskPrompt";
import { SiteTourCarouselHost } from "@/components/onboarding/SiteTourCarouselHost";
import { SitePresenceProvider } from "@/components/providers/SitePresenceProvider";
import { cn } from "@/lib/utils";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";

interface AppLayoutProps {
  children: ReactNode;
  streakTimer?: ReturnType<typeof useStreakTimer>;
  /** When true, hides the global top nav (legacy; prefer showing nav + wideMain for dashboards). */
  hideTopNav?: boolean;
  /** Wide main column (e.g. dashboard + sidebar) while top nav stays visible. */
  wideMain?: boolean;
}

/** Curriculum browser: URL stays `/explore-1`; UI label is "Lessons". */
export const EXPLORE_APP_PATH = "/explore-1" as const;

/** Header nav brand image — new resized logo at `public/images/logo-2.png` (served as `/images/logo-2.png`). */
const EDUBLAST_WORDMARK_SRC = "/images/logo-2.png";

/** Prep + Mock hub: highlight when user is on mock, revision, or class flows (Exam Prep removed from top nav). */
function isPrepMockActive(pathname: string): boolean {
  if (pathname === "/mock" || pathname === "/mock-test-library" || pathname === "/exam-prep")
    return true;
  if (pathname === "/classrooms" || pathname === "/revision") return true;
  if (pathname.startsWith("/classroom/")) return true;
  return false;
}

function isNavLinkActive(navPath: string, pathname: string): boolean {
  if (pathname === navPath) return true;
  if (navPath === "/mock" && isPrepMockActive(pathname)) return true;
  if (navPath === "/edufund" && (pathname === "/edufund" || pathname.startsWith("/edufund/")))
    return true;
  if (navPath === "/news-blog" && (pathname === "/news-blog" || pathname.startsWith("/news-blog/")))
    return true;
  return false;
}

type AppNavItem = {
  path: string;
  /** When set, used as Link href (e.g. teacher portal default tab). */
  href?: string;
  icon: LucideIcon;
  label: string;
  emoji: string;
};

const studentNavItems: AppNavItem[] = [
  { path: "/home", icon: LayoutDashboard, label: "Dashboard", emoji: "📊" },
  { path: "/magic-wall", icon: Sparkles, label: "Magic Wall", emoji: "✨" },
  { path: EXPLORE_APP_PATH, icon: Compass, label: "Lessons", emoji: "🧭" },
  { path: "/mock", icon: GraduationCap, label: "Prep + Mock", emoji: "🎓" },
  { path: "/doubts", icon: HelpCircle, label: "Gyan++", emoji: "💡" },
  { path: "/refer-earn", icon: Gift, label: "Earn & Learn", emoji: "🎁" },
  { path: "/edufund", icon: Heart, label: "EduFund", emoji: "💛" },
  { path: "/news-blog", icon: Newspaper, label: "News & Blogs", emoji: "📰" },
];

const teacherNavItems: AppNavItem[] = [
  {
    path: "/teacher-portal",
    href: TEACHER_PORTAL_CLASSROOMS_URL,
    icon: GraduationCap,
    label: "Teacher Portal",
    emoji: "🧑‍🏫",
  },
];

const AppLayout = ({
  children,
  streakTimer,
  hideTopNav = false,
  wideMain = false,
}: AppLayoutProps) => {
  const pathname = usePathname();
  const isMagicWall = pathname === "/magic-wall";
  const { profile, user: authUser } = useAuth();
  const presenceUserId = profile?.id ?? authUser?.id ?? null;
  const user = useUserStore((s) => s.user);
  const rdm = profile?.rdm ?? user?.rdm ?? 0;
  const allResults = useUserStore((s) => s.allResults);
  const isTeacher = profile?.role === "teacher";
  const isAdminOnLocalhost =
    profile?.role === "admin" &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const navItems = isTeacher ? teacherNavItems : studentNavItems;

  const teacherPortalHref = "/teacher-portal?section=profile";
  const isTeacherPortalProfileActive = isTeacher && pathname.startsWith("/teacher-portal");
  const isStudentProfileNavActive =
    !isTeacher && (pathname === "/profile" || pathname.startsWith("/profile/"));

  return (
    <SitePresenceProvider userId={presenceUserId}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Top Navigation Bar */}
        {!hideTopNav && (
          <header className="sticky top-0 z-40 shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/60">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-0.5 lg:max-w-[min(100%,90rem)] lg:px-5 lg:py-1 xl:max-w-[min(100%,96rem)] 2xl:px-6">
              {/* Logo — layout box stays compact; scale() enlarges artwork without growing nav flex height */}
              <Link
                href={isTeacher ? TEACHER_PORTAL_CLASSROOMS_URL : "/home"}
                className="relative z-10 flex shrink-0 items-center hover:opacity-80 transition-opacity"
              >
                <Image
                  src={EDUBLAST_WORDMARK_SRC}
                  alt="EduBlast"
                  width={320}
                  height={90}
                  priority
                  draggable={false}
                  className={cn(
                    "h-12 w-auto origin-left sm:h-[52px] 2xl:h-14",
                    "scale-[1.09] sm:scale-[1.05] 2xl:scale-[1.05]"
                  )}
                />
              </Link>

              {/* Nav Links - Desktop */}
              <nav className="hidden md:flex items-center gap-0.5 bg-muted/50 rounded-xl p-0.5 2xl:rounded-2xl 2xl:p-1">
                {navItems.map(({ path, href: itemHref, icon: Icon, label }) => {
                  const linkHref = itemHref ?? path;
                  const isActive = isNavLinkActive(path, pathname);
                  return (
                    <Link
                      key={path}
                      href={linkHref}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all 2xl:gap-2 2xl:rounded-xl 2xl:px-4 2xl:py-1.5 2xl:text-sm ${
                        isActive
                          ? "bg-card text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon
                        className="w-3.5 h-3.5 shrink-0 2xl:w-4 2xl:h-4"
                        suppressHydrationWarning
                      />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              {/* Right side */}
              <div className="flex items-center gap-2 2xl:gap-3">
                {streakTimer?.isActive && (
                  <StreakTimer
                    phase={streakTimer.phase}
                    secondsLeft={streakTimer.secondsLeft}
                    totalSeconds={streakTimer.totalSeconds}
                  />
                )}
                {(user || profile) && (
                  <Link
                    href="/pricing"
                    className="flex items-center gap-1.5 bg-edu-yellow/15 hover:bg-edu-yellow/25 px-2.5 py-1 rounded-full transition-colors 2xl:px-3.5 2xl:py-1.5"
                  >
                    <Coins className="w-4 h-4 text-edu-orange" suppressHydrationWarning />
                    <span className="font-extrabold text-sm text-foreground">{rdm}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline font-bold">
                      RDM
                    </span>
                  </Link>
                )}
                <NotificationBell />
                {isTeacher ? (
                  <Link
                    href={teacherPortalHref}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-colors 2xl:h-9 2xl:w-9 2xl:rounded-xl",
                      isTeacherPortalProfileActive
                        ? "bg-card text-primary shadow-sm ring-1 ring-primary/25"
                        : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                    aria-label="Settings"
                    aria-current={isTeacherPortalProfileActive ? "page" : undefined}
                  >
                    <Settings
                      className={cn(
                        "h-4 w-4 2xl:h-[18px] 2xl:w-[18px]",
                        isTeacherPortalProfileActive ? "text-primary" : ""
                      )}
                      suppressHydrationWarning
                    />
                  </Link>
                ) : (
                  <Link
                    href="/profile"
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full transition-colors 2xl:h-9 2xl:w-9",
                      isStudentProfileNavActive
                        ? "shadow-sm ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                        : "ring-1 ring-transparent hover:ring-white/25"
                    )}
                    aria-label="Profile"
                    aria-current={isStudentProfileNavActive ? "page" : undefined}
                  >
                    <span
                      className={cn(
                        "flex h-full w-full items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-blue-600 shadow-inner",
                        isStudentProfileNavActive && "ring-[1.5px] ring-inset ring-white/35"
                      )}
                    >
                      <User
                        className="h-4 w-4 text-white drop-shadow-sm 2xl:h-[18px] 2xl:w-[18px]"
                        strokeWidth={2.25}
                        suppressHydrationWarning
                      />
                    </span>
                  </Link>
                )}
              </div>
            </div>

            {/* Mobile nav */}
            <div className="md:hidden border-t border-border/60">
              <div className="flex overflow-x-auto px-2 gap-0.5">
                {navItems.map(({ path, href: itemHref, label, emoji }) => {
                  const linkHref = itemHref ?? path;
                  const isActive = isNavLinkActive(path, pathname);
                  return (
                    <Link
                      key={path}
                      href={linkHref}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
                        isActive
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="text-sm">{emoji}</span>
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </header>
        )}

        {/* Content */}
        <main
          className={cn(
            "flex-1 mx-auto w-full",
            hideTopNav || wideMain
              ? "max-w-[1920px] px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5"
              : "max-w-7xl px-4 lg:px-5 2xl:px-6",
            !hideTopNav &&
              !wideMain &&
              (isMagicWall ? "flex min-h-0 flex-col pt-2 pb-0 sm:pt-3" : "py-4 lg:py-5 2xl:py-7"),
            !hideTopNav &&
              wideMain &&
              (isMagicWall ? "flex min-h-0 flex-col pt-2 pb-0 sm:pt-3" : ""),
            hideTopNav && isMagicWall && "flex min-h-0 flex-col pt-2 pb-0 sm:pt-3"
          )}
        >
          {children}
        </main>

        {/* Overlay screens */}
        {streakTimer?.isActive && streakTimer.phase === "break" && (
          <BreakScreen secondsLeft={streakTimer.secondsLeft} />
        )}
        {streakTimer?.isActive && streakTimer.phase === "recall" && (
          <RecallExercise
            secondsLeft={streakTimer.secondsLeft}
            recentResults={allResults.slice(-5)}
          />
        )}
        {isAdminOnLocalhost && <AgentOrchestratorRunner />}
        <OnboardingRewardToastListener />
        <FloatingTaskCompanion />
        <OnboardingNextTaskPrompt />
        <SiteTourCarouselHost />

        {/* Footer */}
        {!isTeacher ? (
          <footer className="border-t border-border/60 bg-card/40 py-3 lg:py-4 2xl:py-5">
            <div className="max-w-7xl mx-auto px-4 lg:px-5 2xl:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-xs text-muted-foreground">
              <span className="font-bold">© 2026 EduBlast — Learn thru Questions 🎯</span>
              <div className="flex gap-6">
                <Link href="/pricing" className="hover:text-foreground transition-colors font-bold">
                  Pricing
                </Link>
                <Link href="/profile" className="hover:text-foreground transition-colors font-bold">
                  Profile
                </Link>
                <Link
                  href={EXPLORE_APP_PATH}
                  className="hover:text-foreground transition-colors font-bold"
                >
                  Lessons
                </Link>
                <Link
                  href={`/contact?from=${encodeURIComponent(pathname || "/home")}`}
                  className="hover:text-foreground transition-colors font-bold"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </footer>
        ) : null}
      </div>
    </SitePresenceProvider>
  );
};

export default AppLayout;
