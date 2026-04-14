"use client";

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/useUserStore';
import { LayoutDashboard, Compass, Sparkles, User, Coins, Settings, HelpCircle, Heart, GraduationCap, Gift } from 'lucide-react';
import StreakTimer from '@/components/StreakTimer';
import NotificationBell from '@/components/NotificationBell';
import BreakScreen from '@/components/BreakScreen';
import RecallExercise from '@/components/RecallExercise';
import { useStreakTimer } from '@/hooks/useStreakTimer';
import AgentOrchestratorRunner from '@/components/AgentOrchestratorRunner';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  streakTimer?: ReturnType<typeof useStreakTimer>;
}

/** Curriculum browser: URL stays `/explore-1`; UI label is "Lessons". */
export const EXPLORE_APP_PATH = "/explore-1" as const;

/** Prep + Mock hub: highlight when user is on mock, revision, or class flows (Exam Prep removed from top nav). */
function isPrepMockActive(pathname: string): boolean {
  if (pathname === "/mock" || pathname === "/exam-prep") return true;
  if (pathname === "/classrooms" || pathname === "/revision") return true;
  if (pathname.startsWith("/classroom/")) return true;
  return false;
}

const baseNavItems = [
  { path: "/home", icon: LayoutDashboard, label: "Dashboard", emoji: "📊" },
  { path: "/magic-wall", icon: Sparkles, label: "Magic Wall", emoji: "✨" },
  { path: EXPLORE_APP_PATH, icon: Compass, label: "Lessons", emoji: "🧭" },
  { path: "/mock", icon: GraduationCap, label: "Prep + Mock", emoji: "🎓" },
  { path: "/doubts", icon: HelpCircle, label: "Gyan++", emoji: "💡" },
  { path: "/edufund", icon: Heart, label: "EduFund", emoji: "💛" },
  { path: "/refer-earn", icon: Gift, label: "Refer & Earn", emoji: "🎁" },
  { path: "/profile", icon: User, label: "Profile", emoji: "👤" },
];

const AppLayout = ({ children, streakTimer }: AppLayoutProps) => {
  const pathname = usePathname();
  const isMagicWall = pathname === '/magic-wall';
  const { profile } = useAuth();
  const user = useUserStore((s) => s.user);
  const rdm = profile?.rdm ?? user?.rdm ?? 0;
  const allResults = useUserStore((s) => s.allResults);
  const navItems = baseNavItems;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2.5 lg:px-5 lg:py-3 2xl:px-6">
          {/* Logo */}
          <Link href="/home" className="flex items-center gap-2 hover:opacity-80 transition-opacity group 2xl:gap-2.5">
            <span className="text-xl group-hover:scale-110 transition-transform 2xl:text-2xl">🎯</span>
            <h1 className="text-xl font-display bg-clip-text text-transparent 2xl:text-2xl" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              EduBlast
            </h1>
          </Link>

          {/* Nav Links - Desktop */}
          <nav className="hidden md:flex items-center gap-0.5 bg-muted/50 rounded-xl p-0.5 2xl:rounded-2xl 2xl:p-1">
            {navItems.map(({ path, icon: Icon, label }) => {
              const isActive =
                pathname === path ||
                (path === "/mock" && isPrepMockActive(pathname)) ||
                (path === "/edufund" && (pathname === "/edufund" || pathname.startsWith("/edufund/")));
              return (
                <Link
                  key={path}
                  href={path}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all 2xl:gap-2 2xl:rounded-xl 2xl:px-4 2xl:py-2 2xl:text-sm ${
                    isActive
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 2xl:w-4 2xl:h-4" suppressHydrationWarning />
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
                className="flex items-center gap-1.5 bg-edu-yellow/15 hover:bg-edu-yellow/25 px-2.5 py-1.5 rounded-full transition-colors 2xl:px-3.5 2xl:py-2"
              >
                <Coins className="w-4 h-4 text-edu-orange" suppressHydrationWarning />
                <span className="font-extrabold text-sm text-foreground">{rdm}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline font-bold">RDM</span>
              </Link>
            )}
            <NotificationBell />
            <Link
              href="/profile"
              className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors 2xl:w-9 2xl:h-9 2xl:rounded-xl"
            >
              <Settings className="w-4 h-4 text-muted-foreground 2xl:w-[18px] 2xl:h-[18px]" suppressHydrationWarning />
            </Link>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t border-border/60">
          <div className="flex overflow-x-auto px-2 gap-0.5">
            {navItems.map(({ path, icon: Icon, label, emoji }) => {
              const isActive =
                pathname === path ||
                (path === "/mock" && isPrepMockActive(pathname)) ||
                (path === "/edufund" && (pathname === "/edufund" || pathname.startsWith("/edufund/")));
              return (
                <Link
                  key={path}
                  href={path}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
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

      {/* Content */}
      <main
        className={cn(
          'flex-1 max-w-7xl mx-auto w-full px-4 lg:px-5 2xl:px-6',
          isMagicWall ? 'flex min-h-0 flex-col pt-2 pb-0 sm:pt-3' : 'py-4 lg:py-5 2xl:py-7',
        )}
      >
        {children}
      </main>

      {/* Overlay screens */}
      {streakTimer?.isActive && streakTimer.phase === 'break' && (
        <BreakScreen secondsLeft={streakTimer.secondsLeft} />
      )}
      {streakTimer?.isActive && streakTimer.phase === 'recall' && (
        <RecallExercise secondsLeft={streakTimer.secondsLeft} recentResults={allResults.slice(-5)} />
      )}
      <AgentOrchestratorRunner />

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card/40 py-3 lg:py-4 2xl:py-5">
        <div className="max-w-7xl mx-auto px-4 lg:px-5 2xl:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-xs text-muted-foreground">
          <span className="font-bold">© 2026 EduBlast — Learn thru Questions 🎯</span>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:text-foreground transition-colors font-bold">Pricing</Link>
            <Link href="/profile" className="hover:text-foreground transition-colors font-bold">Profile</Link>
            <Link href={EXPLORE_APP_PATH} className="hover:text-foreground transition-colors font-bold">Lessons</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
