"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import styles from "./AppLayout.module.css";
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
  Users,
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
import StudentRdmWalletDialog from "@/components/wallet/StudentRdmWalletDialog";
import { requestOpenSiteTourCarousel } from "@/lib/onboarding/openSiteTourCarousel";

interface AppLayoutProps {
  children: ReactNode;
  streakTimer?: ReturnType<typeof useStreakTimer>;
  /** When true, hides the global top nav (legacy; prefer showing nav + wideMain for dashboards). */
  hideTopNav?: boolean;
  /** Wide main column (e.g. dashboard + sidebar) while top nav stays visible. */
  wideMain?: boolean;
  /** Custom full-bleed mode for redesign mockups (removes layout padding, footers, headers). */
  fullBleed?: boolean;
}

/** Curriculum browser: URL stays `/explore-1`; UI label is "Learn Hub". */
export const EXPLORE_APP_PATH = "/explore-1" as const;

/** Header nav brand image â€” new resized logo at `public/images/logo-2.png` (served as `/images/logo-2.png`). */
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
  if (
    navPath === "/explore/community" &&
    (pathname === "/explore/community" || pathname.startsWith("/explore/community/"))
  )
    return true;
  if (
    navPath === "/news-blog" &&
    (pathname === "/news-blog" || pathname.startsWith("/news-blog/"))
  )
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
  { path: "/home", icon: LayoutDashboard, label: "Dashboard", emoji: "ðŸ“Š" },
  { path: "/magic-wall", icon: Sparkles, label: "Magic Wall", emoji: "âœ¨" },
  { path: EXPLORE_APP_PATH, icon: Compass, label: "Learn Hub", emoji: "ðŸ§­" },
  { path: "/mock", icon: GraduationCap, label: "Prep + Classes", emoji: "ðŸŽ“" },
  { path: "/doubts", icon: HelpCircle, label: "Gyan++", emoji: "ðŸ’¡" },
  { path: "/refer-earn", icon: Gift, label: "Earn & Learn", emoji: "ðŸŽ" },
  { path: "/edufund", icon: Heart, label: "Edufundz", emoji: "ðŸ’›" },
  { path: "/news-blog", icon: Newspaper, label: "News & Blogs", emoji: "ðŸ“°" },
  { path: "/explore/community", icon: Users, label: "Community", emoji: "ðŸ‘¥" },
];

const teacherNavItems: AppNavItem[] = [
  {
    path: "/teacher-portal",
    href: TEACHER_PORTAL_CLASSROOMS_URL,
    icon: GraduationCap,
    label: "Teacher Portal",
    emoji: "ðŸ§‘â€ðŸ«",
  },
];

const STUDENT_SIDEBAR_EXCLUDED_PREFIXES = [
  "/teacher-portal",
  "/auth",
  "/join",
  "/onboarding",
] as const;

function shouldShowStudentDashboardSidebar(
  pathname: string,
  homeTab: string | null,
  opts: {
    isTeacher: boolean;
    fullBleed: boolean;
    hideTopNav: boolean;
  }
): boolean {
  if (opts.isTeacher || opts.fullBleed || opts.hideTopNav) {
    return false;
  }
  // DashboardLayout owns the actual sidebar; AppLayout only offsets shared chrome.
  return pathname === "/home" && homeTab === "dashboard";
}

const AppLayout = ({
  children,
  streakTimer,
  hideTopNav = false,
  wideMain = false,
  fullBleed = false,
}: AppLayoutProps) => {
  const pathname = usePathname();
  const isMagicWall = pathname === "/magic-wall";
  const isCommunityWall = pathname.startsWith("/explore/community");
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
  const [studentWalletOpen, setStudentWalletOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState({
    info: true,
    prep: true,
    fun: true,
    earn: true,
  });
  const toggleSection = (key: "info" | "prep" | "fun" | "earn") => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const homeTab = pathname === "/home" ? searchParams.get("page") ?? "home" : null;
  const isHomeNavActive = homeTab === "home" || homeTab === null && pathname === "/home" && !searchParams.get("page");
  const isDashboardNavActive = homeTab === "dashboard";
  const isRedesignedLayout = pathname === "/home" && homeTab !== "dashboard";
  const isAboutNavActive = pathname === "/contact" || pathname.startsWith("/contact/");
  const hasStudentDashboardSidebar = shouldShowStudentDashboardSidebar(pathname, homeTab, {
    isTeacher,
    fullBleed,
    hideTopNav,
  });

  const initials = (() => {
    if (!profile) return "ST";
    const name = profile.name || "Student";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  })();

  const isTourClaimed = profile?.free_trial_checklist_reward_claimed_ever === true;
  const { signOut } = useAuth();

  useEffect(() => {
    const handleOpenWallet = () => setStudentWalletOpen(true);
    window.addEventListener("open-rdm-wallet", handleOpenWallet);
    return () => window.removeEventListener("open-rdm-wallet", handleOpenWallet);
  }, []);

  // Inject Tabler Icons for the student navbar icons
  useEffect(() => {
    if (isTeacher) return;
    const HREF = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css";
    if (document.querySelector(`link[href="${HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HREF;
    document.head.appendChild(link);
  }, [isTeacher]);

  return (
    <SitePresenceProvider userId={presenceUserId}>
      <div
        className="min-h-screen flex flex-col"
        style={{ backgroundColor: isRedesignedLayout ? "#0A0F1E" : "var(--background)" }}
      >
        {/* Top Navigation Bar */}
        {!hideTopNav && !fullBleed && (
          isTeacher ? (
            <header className="sticky top-0 z-40 shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/60">
              <div className="mx-auto grid w-full max-w-[min(100%,1920px)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-0.5 pl-3 pr-2 sm:gap-3 sm:pl-4 sm:pr-2.5 lg:py-1 lg:pl-5 lg:pr-2.5 xl:pr-3">
                {/* Logo â€” layout box stays compact; scale() enlarges artwork without growing nav flex height */}
                <Link
                  href={TEACHER_PORTAL_CLASSROOMS_URL}
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

                {/* Nav Links - Desktop (centered in remaining space) */}
                <nav className="hidden md:flex min-w-0 items-center justify-center">
                  <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-muted/50 p-0.5 2xl:rounded-2xl 2xl:p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  </div>
                </nav>

                {/* Right side â€” flush to the right edge of the header bar */}
                <div className="flex shrink-0 items-center justify-end gap-1.5 2xl:gap-2">
                  {streakTimer?.isActive && (
                    <StreakTimer
                      phase={streakTimer.phase}
                      secondsLeft={streakTimer.secondsLeft}
                      totalSeconds={streakTimer.totalSeconds}
                    />
                  )}
                  <NotificationBell />
                  <div className="flex items-center gap-1.5 2xl:gap-2">
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
                  </div>
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
          ) : (
            <nav
              className={styles.nav}
              style={isRedesignedLayout ? undefined : {
                "--nav-bg": "var(--background)",
                "--nav-border": ".5px solid var(--border)",
              } as React.CSSProperties}
            >
              <Link href="/home" className={styles.navLogo} aria-label="EduBlast home">
                <Image
                  src={EDUBLAST_WORDMARK_SRC}
                  alt="EduBlast"
                  width={320}
                  height={90}
                  priority
                  draggable={false}
                  className={styles.navLogoImage}
                />
              </Link>
              <div className={styles.navLinks}>
                <Link
                  href="/home"
                  className={`${styles.nl} ${isHomeNavActive ? `${styles.on} ${styles.nlPrep}` : ""}`}
                >
                  Home
                </Link>
                <Link
                  href="/home?page=info"
                  className={`${styles.nl} ${homeTab === "info" ? `${styles.on} ${styles.nlInfo}` : ""}`}
                >
                  Info
                </Link>
                <Link
                  href="/home?page=prep"
                  className={`${styles.nl} ${homeTab === "prep" ? `${styles.on} ${styles.nlPrep}` : ""}`}
                >
                  Prep
                </Link>
                <Link
                  href="/home?page=fun"
                  className={`${styles.nl} ${homeTab === "fun" ? `${styles.on} ${styles.nlFun}` : ""}`}
                >
                  Fun
                </Link>
                <Link
                  href="/home?page=earn"
                  className={`${styles.nl} ${homeTab === "earn" ? `${styles.on} ${styles.nlEarn}` : ""}`}
                >
                  Earn
                </Link>
                <Link
                  href="/explore/community"
                  className={`${styles.nl} ${isCommunityWall ? styles.on : ""}`}
                >
                  Community Feed
                </Link>
                <span
                  className={styles.nl}
                  style={{ cursor: "default" }}
                >
                  About
                </span>
              </div>
              <div className={styles.navRight}>
                {/* Site Tour with Star icon + conditional +100 RDM */}
                <button
                  className={styles.tourBtn}
                  onClick={() => requestOpenSiteTourCarousel()}
                  aria-label="Site tour"
                >
                  <i className="ti ti-star" aria-hidden="true"></i>
                  <span className={styles.tourLabel}>Site tour</span>
                  {!isTourClaimed && (
                    <span className={styles.tourRdmBadge}>+100 RDM</span>
                  )}
                </button>

                {/* Sign Out Button */}
                <button className={styles.signoutBtn} onClick={() => signOut()}>
                  <i className="ti ti-logout" aria-hidden="true"></i>
                  <span>Sign out</span>
                </button>

                {/* RDM Pill */}
                <div className={styles.rdmBadge} onClick={() => setStudentWalletOpen(true)}>
                  <i className="ti ti-coin rdm-coin" aria-hidden="true"></i>
                  {rdm} RDM
                </div>

                {/* Dynamic Notification Bell */}
                <div className={styles.bellBtn} aria-label="Notifications" style={{ border: "none", background: "transparent" }}>
                  <NotificationBell />
                </div>

                {/* Profile Avatar */}
                <Link href="/profile" className={styles.navAv} aria-label="Profile">
                  {initials}
                </Link>

                {/* Burger Quick-Menu Icon */}
                <div
                  className={`${styles.burgerBtn} ${drawerOpen ? styles.open : ""}`}
                  onClick={() => setDrawerOpen(!drawerOpen)}
                  aria-label="Quick navigation menu"
                  aria-expanded={drawerOpen}
                >
                  <i className="ti ti-menu-2" aria-hidden="true"></i>
                </div>
              </div>
            </nav>
          )
        )}

        {/* QUICK NAVIGATION DRAWER FOR STUDENTS */}
        {!isTeacher && (
          <>
            <div
              className={`${styles.drawerBackdrop} ${drawerOpen ? styles.on : ""}`}
              onClick={() => setDrawerOpen(false)}
            ></div>

            <div className={`${styles.drawer} ${drawerOpen ? styles.on : ""}`} style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              <div className={styles.drawerHead}>
                <div className={styles.drawerTitle}>
                  <i className="ti ti-compass" aria-hidden="true"></i>Quick Nav
                </div>
                <div className={styles.drawerSub}>Jump to any feature instantly</div>
              </div>

              {/* INFO SECTION */}
              <div className={`${styles.dsec} ${styles.dsecInfo}`}>
                <div className={styles.dsecHdr} onClick={() => toggleSection("info")}>
                  <div className={styles.dsecIcon}>
                    <i className="ti ti-info-circle" aria-hidden="true"></i>
                  </div>
                  <span className={styles.dsecLabel}>Info</span>
                  <span className={styles.dsecTagline}>Stay on Track</span>
                  <i
                    className={`ti ti-chevron-down ${styles.dsecChevron} ${
                      sectionsOpen.info ? styles.open : ""
                    }`}
                    aria-hidden="true"
                  ></i>
                </div>
                <div
                  className={styles.dsecItems}
                  style={{ maxHeight: sectionsOpen.info ? "400px" : "0px" }}
                >
                  <Link href="/home?page=dashboard" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(55, 138, 221, 0.12)", border: ".5px solid rgba(55, 138, 221, 0.2)" }}
                    >
                      <i className="ti ti-layout-dashboard" style={{ fontSize: "14px", color: "var(--blue)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>My Dashboard</div>
                      <div className={styles.ditemDesc}>Daily tracker, checklist, leaderboard</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/news-blog" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(55, 138, 221, 0.12)", border: ".5px solid rgba(55, 138, 221, 0.2)" }}
                    >
                      <i className="ti ti-news" style={{ fontSize: "14px", color: "var(--blue)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>News &amp; Blogs</div>
                      <div className={styles.ditemDesc}>JEE updates, NTA alerts, study tips</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/performance" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(55, 138, 221, 0.12)", border: ".5px solid rgba(55, 138, 221, 0.2)" }}
                    >
                      <i className="ti ti-chart-bar" style={{ fontSize: "14px", color: "var(--blue)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>My Progress</div>
                      <div className={styles.ditemDesc}>Score trends, accuracy, habits checkin</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                </div>
              </div>
              <div className={styles.ddiv}></div>

              {/* PREP SECTION */}
              <div className={`${styles.dsec} ${styles.dsecPrep}`}>
                <div className={styles.dsecHdr} onClick={() => toggleSection("prep")}>
                  <div className={styles.dsecIcon}>
                    <i className="ti ti-books" aria-hidden="true"></i>
                  </div>
                  <span className={styles.dsecLabel}>Prep</span>
                  <span className={styles.dsecTagline}>Ace Your Exam</span>
                  <i
                    className={`ti ti-chevron-down ${styles.dsecChevron} ${
                      sectionsOpen.prep ? styles.open : ""
                    }`}
                    aria-hidden="true"
                  ></i>
                </div>
                <div
                  className={styles.dsecItems}
                  style={{ maxHeight: sectionsOpen.prep ? "600px" : "0px" }}
                >
                  <Link href="/explore-1" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(29, 158, 117, 0.12)", border: ".5px solid rgba(29, 158, 117, 0.2)" }}
                    >
                      <i className="ti ti-books" style={{ fontSize: "14px", color: "var(--teal)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>LearnHub</div>
                      <div className={styles.ditemDesc}>Physics, Chemistry, Mathematics</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/revision" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(29, 158, 117, 0.12)", border: ".5px solid rgba(29, 158, 117, 0.2)" }}
                    >
                      <i className="ti ti-video" style={{ fontSize: "14px", color: "var(--teal)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>Classes + Mock</div>
                      <div className={styles.ditemDesc}>Live webinars, past papers 2008-2024</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/doubts" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(29, 158, 117, 0.12)", border: ".5px solid rgba(29, 158, 117, 0.2)" }}
                    >
                      <i className="ti ti-help-circle" style={{ fontSize: "14px", color: "var(--teal)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>Gyan++</div>
                      <div className={styles.ditemDesc}>Ask Prof-Pi AI - instant answers</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/mock#calendar" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(29, 158, 117, 0.12)", border: ".5px solid rgba(29, 158, 117, 0.2)" }}
                    >
                      <i className="ti ti-calendar" style={{ fontSize: "14px", color: "var(--teal)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>AI Study Planner</div>
                      <div className={styles.ditemDesc}>Personalised calendar, auto-reschedule</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                </div>
              </div>
              <div className={styles.ddiv}></div>

              {/* FUN SECTION */}
              <div className={`${styles.dsec} ${styles.dsecFun}`}>
                <div className={styles.dsecHdr} onClick={() => toggleSection("fun")}>
                  <div className={styles.dsecIcon}>
                    <i className="ti ti-confetti" aria-hidden="true"></i>
                  </div>
                  <span className={styles.dsecLabel}>Fun</span>
                  <span className={styles.dsecTagline}>Fun while Learn</span>
                  <i
                    className={`ti ti-chevron-down ${styles.dsecChevron} ${
                      sectionsOpen.fun ? styles.open : ""
                    }`}
                    aria-hidden="true"
                  ></i>
                </div>
                <div
                  className={styles.dsecItems}
                  style={{ maxHeight: sectionsOpen.fun ? "400px" : "0px" }}
                >
                  <Link href="/play" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(127, 119, 221, 0.12)", border: ".5px solid rgba(127, 119, 221, 0.2)" }}
                    >
                      <i className="ti ti-bolt" style={{ fontSize: "14px", color: "var(--purple)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>DailyDose</div>
                      <div className={styles.ditemDesc}>5 PCM questions | +25 RDM daily</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/play" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(127, 119, 221, 0.12)", border: ".5px solid rgba(127, 119, 221, 0.2)" }}
                    >
                      <i className="ti ti-tournament" style={{ fontSize: "14px", color: "var(--purple)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>Funbrain</div>
                      <div className={styles.ditemDesc}>Speed rounds | +500 RDM prize pool</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/explore/community" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(127, 119, 221, 0.12)", border: ".5px solid rgba(127, 119, 221, 0.2)" }}
                    >
                      <i className="ti ti-social" style={{ fontSize: "14px", color: "var(--purple)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>Community Feed</div>
                      <div className={styles.ditemDesc}>Post scores | +5 RDM per post</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/magic-wall" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(127, 119, 221, 0.12)", border: ".5px solid rgba(127, 119, 221, 0.2)" }}
                    >
                      <i className="ti ti-wand" style={{ fontSize: "14px", color: "var(--purple)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>Magic Wall</div>
                      <div className={styles.ditemDesc}>Social topic feed - scroll and learn</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                </div>
              </div>
              <div className={styles.ddiv}></div>

              {/* EARN SECTION */}
              <div className={`${styles.dsec} ${styles.dsecEarn}`}>
                <div className={styles.dsecHdr} onClick={() => toggleSection("earn")}>
                  <div className={styles.dsecIcon}>
                    <i className="ti ti-pig-money" aria-hidden="true"></i>
                  </div>
                  <span className={styles.dsecLabel}>Earn</span>
                  <span className={styles.dsecTagline}>Unburden Your Parents</span>
                  <i
                    className={`ti ti-chevron-down ${styles.dsecChevron} ${
                      sectionsOpen.earn ? styles.open : ""
                    }`}
                    aria-hidden="true"
                  ></i>
                </div>
                <div
                  className={styles.dsecItems}
                  style={{ maxHeight: sectionsOpen.earn ? "400px" : "0px" }}
                >
                  <Link href="/refer-earn" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(239, 159, 39, 0.12)", border: ".5px solid rgba(239, 159, 39, 0.2)" }}
                    >
                      <i className="ti ti-share" style={{ fontSize: "14px", color: "var(--amber)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>Earn and Learn</div>
                      <div className={styles.ditemDesc}>+500 RDM per friend | no cap</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/refer-earn" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(239, 159, 39, 0.12)", border: ".5px solid rgba(239, 159, 39, 0.2)" }}
                    >
                      <i className="ti ti-trophy" style={{ fontSize: "14px", color: "var(--amber)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>Earn thru Challenges</div>
                      <div className={styles.ditemDesc}>Weekly blitz | +2,000 RDM prize pool</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <Link href="/edufund?onboarding_edufund=1" className={styles.ditem} onClick={() => setDrawerOpen(false)}>
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(239, 159, 39, 0.12)", border: ".5px solid rgba(239, 159, 39, 0.2)" }}
                    >
                      <i className="ti ti-heart" style={{ fontSize: "14px", color: "var(--amber)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>Unlock Edufundz</div>
                      <div className={styles.ditemDesc}>Rs 3K-Rs 50K grants | no income test</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </Link>
                  <div
                    className={styles.ditem}
                    onClick={() => {
                      setDrawerOpen(false);
                      window.dispatchEvent(new CustomEvent("open-rdm-wallet"));
                    }}
                  >
                    <div
                      className={styles.ditemIcon}
                      style={{ background: "rgba(239, 159, 39, 0.12)", border: ".5px solid rgba(239, 159, 39, 0.2)" }}
                    >
                      <i className="ti ti-gift" style={{ fontSize: "14px", color: "var(--amber)" }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.ditemBody}>
                      <div className={styles.ditemName}>RDM Rewards</div>
                      <div className={styles.ditemDesc}>Pro trial, merch, scholarship draw</div>
                    </div>
                    <i className={`ti ti-arrow-right ${styles.ditemArrow}`} aria-hidden="true"></i>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Content */}
        <main
          className={cn(
            isRedesignedLayout
              ? "w-full flex-1"
              : fullBleed
              ? "w-full min-h-0"
              : cn(
                  "flex-1 mx-auto w-full",
                  hideTopNav || wideMain
                    ? cn(
                        "max-w-[1920px]",
                        isCommunityWall
                          ? "px-1.5 py-1 sm:px-2 lg:px-2.5 lg:py-2"
                          : "px-2 py-3 sm:px-3 sm:py-4 lg:px-5 lg:py-5"
                      )
                    : "max-w-7xl px-4 lg:px-5 2xl:px-6"
                ),
            hasStudentDashboardSidebar && !fullBleed && "lg:ml-[52px]",
            !isRedesignedLayout && !hideTopNav &&
              !wideMain &&
              !fullBleed &&
              (isMagicWall ? "flex min-h-0 flex-col pt-2 pb-0 sm:pt-3" : "py-4 lg:py-5 2xl:py-7"),
            !isRedesignedLayout && !hideTopNav &&
              wideMain &&
              !fullBleed &&
              (isMagicWall ? "flex min-h-0 flex-col pt-2 pb-0 sm:pt-3" : ""),
            !isRedesignedLayout && hideTopNav && !fullBleed && isMagicWall && "flex min-h-0 flex-col pt-2 pb-0 sm:pt-3"
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

        {!isTeacher ? (
          <StudentRdmWalletDialog
            open={studentWalletOpen}
            onClose={() => setStudentWalletOpen(false)}
            balance={rdm}
          />
        ) : null}

        {/* Footer */}
        {!isTeacher && !fullBleed ? (
          <footer
            className={cn(
              "border-t border-border/60 bg-card/40 py-3 lg:py-4 2xl:py-5",
              hasStudentDashboardSidebar && "lg:ml-[52px]"
            )}
          >
            <div className="max-w-7xl mx-auto px-4 lg:px-5 2xl:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-xs text-muted-foreground">
              <span className="font-bold">(c) 2026 EduBlast - Learn thru Questions</span>
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
                  Learn Hub
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

