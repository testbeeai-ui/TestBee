"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { withNextQuery } from "@/lib/auth/safeNextPath";
import { cn } from "@/lib/utils";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";
import { NAV_LINKS } from "./landing-constants";

/** Landing nav — same resized logo as main app (`public/images/logo-2.png`). */
const EDUBLAST_WORDMARK_SRC = "/images/logo-2.png";

type NavItem = { label: string; href: string };

export default function LandingNavbar({
  variant = "light",
  navLinks,
  /** When user opened a shared lesson link, preserve it on Sign in / auth nav. */
  sharedNext,
  onOpenWaitlist,
  onOpenSignInNotice,
}: {
  variant?: "light" | "dark";
  navLinks?: NavItem[];
  /** When user opened a shared lesson link, preserve it on Sign in / auth nav. */
  sharedNext?: string | null;
  onOpenWaitlist?: (role?: string) => void;
  onOpenSignInNotice?: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const links = navLinks ?? NAV_LINKS;
  const isDark = variant === "dark";
  const isSignedIn = Boolean(user && profile?.onboarding_complete);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (href: string) => {
    if (!mounted || !pathname) return false;
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#") || href.startsWith("#")) return false;
    return pathname.startsWith(href);
  };

  const handleWaitlist = (role?: string) => {
    const roleStr = typeof role === "string" ? role : undefined;
    if (onOpenWaitlist) {
      onOpenWaitlist(roleStr);
    } else {
      if (roleStr === "teacher") {
        router.push("/auth?role=teacher");
      } else {
        router.push(roleStr ? `/waitlist?role=${roleStr}` : "/waitlist");
      }
    }
  };

  return (
    <nav
      id="top"
      className={
        isDark
          ? "sticky top-0 z-50 border-b border-white/10 bg-[#000000]/92 backdrop-blur-xl"
          : "sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/60"
      }
    >
      <div
        className={
          isDark
            ? "mx-auto grid h-14 w-full max-w-[min(100%,1200px)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:gap-4 sm:px-5 lg:gap-5"
            : "relative mx-auto flex h-14 w-full max-w-[min(100%,1200px)] items-center justify-between px-4 sm:px-5"
        }
      >
        {/* Logo — logo-2.png (resized), matches AppLayout */}
        <Link
          href="/"
          className="relative z-10 flex shrink-0 items-center hover:opacity-90 transition-opacity"
        >
          <img
            src={EDUBLAST_WORDMARK_SRC}
            alt="EduBlast"
            className={cn("h-12 w-auto origin-left sm:h-[52px]", "scale-[1.05] sm:scale-[1.05]")}
            draggable={false}
          />
        </Link>

        {/* Desktop links — middle column (investor) or flow (light) */}
        <div
          className={
            isDark
              ? "hidden min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:flex md:items-center md:justify-center md:gap-2.5 lg:gap-4 xl:gap-5"
              : "hidden md:flex items-center gap-5"
          }
        >
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <a
                key={l.label}
                href={l.href.startsWith("/auth") ? withNextQuery(l.href, sharedNext) : l.href}
                className={
                  isDark
                    ? cn(
                        "shrink-0 whitespace-nowrap text-[11px] tracking-wide transition-all duration-200 md:text-[12px] xl:text-[13px] font-bold pb-0.5 border-b-2",
                        active
                          ? "text-zinc-100 border-[#34f5a4]"
                          : "text-zinc-300 hover:text-white border-transparent"
                      )
                    : cn(
                        "text-sm transition-colors font-medium pb-0.5 border-b-2",
                        active
                          ? "text-gray-900 border-[#1D9E75]"
                          : "text-gray-500 hover:text-gray-900 border-transparent"
                      )
                }
              >
                {l.label}
              </a>
            );
          })}
        </div>

        <div className="relative z-10 flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          {/* Desktop CTAs */}
          <div
            className={
              isDark
                ? "hidden items-center gap-3 md:flex"
                : "hidden shrink-0 items-center gap-2 md:flex"
            }
          >
            {authLoading ? (
              <span
                className={
                  isDark
                    ? "h-9 w-24 rounded-full bg-white/10 animate-pulse"
                    : "h-9 w-24 rounded-lg bg-gray-200 animate-pulse"
                }
                aria-hidden
              />
            ) : isSignedIn ? (
              <Link
                href={profile?.role === "teacher" ? TEACHER_PORTAL_CLASSROOMS_URL : "/home"}
                className={
                  isDark
                    ? "inline-flex h-9 items-center gap-1.5 rounded-full bg-[#34f5a4] px-5 text-[12px] font-bold text-neutral-950 shadow-[0_0_24px_rgba(52,245,164,0.22)] transition-colors hover:bg-[#2ee89a] xl:text-[13px]"
                    : "bg-[#1D9E75] text-white rounded-lg px-[18px] py-2 text-sm font-medium hover:bg-[#178d68] transition-colors"
                }
              >
                Open app <span aria-hidden>↗</span>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (onOpenSignInNotice) {
                      onOpenSignInNotice();
                    } else {
                      handleWaitlist();
                    }
                  }}
                  className={
                    isDark
                      ? "inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-transparent px-4 text-[12px] font-medium text-zinc-200 transition-colors hover:border-white/45 hover:text-white xl:text-[13px]"
                      : "border border-gray-300 rounded-lg px-4 py-[7px] text-sm text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors cursor-pointer"
                  }
                >
                  Sign in
                </button>
                <button
                  onClick={() => handleWaitlist()}
                  className={
                    isDark
                      ? "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#34f5a4] px-5 text-[12px] font-bold text-neutral-950 shadow-[0_0_24px_rgba(52,245,164,0.22)] transition-colors hover:bg-[#2ee89a] xl:text-[13px]"
                      : "bg-[#1D9E75] text-white rounded-lg px-[18px] py-2 text-sm font-medium hover:bg-[#178d68] transition-colors cursor-pointer"
                  }
                >
                  Join Now <span aria-hidden>↗</span>
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={
              isDark
                ? "p-2 text-zinc-300 md:hidden"
                : "md:hidden p-2 text-gray-600"
            }
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div
          className={
            isDark
              ? "md:hidden border-t border-white/10 bg-[#0a0a0a] px-5 pb-4 pt-3 space-y-3"
              : "md:hidden border-t border-gray-200/60 bg-white px-5 pb-4 pt-3 space-y-3"
          }
        >
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <a
                key={l.label}
                href={l.href.startsWith("/auth") ? withNextQuery(l.href, sharedNext) : l.href}
                className={
                  isDark
                    ? cn(
                        "block text-[15px] py-1 transition-colors",
                        active ? "text-[#34f5a4] font-semibold" : "text-zinc-200 hover:text-white"
                      )
                    : cn(
                        "block text-[15px] py-1 transition-colors",
                        active ? "text-[#1D9E75] font-semibold" : "text-gray-650 hover:text-gray-900"
                      )
                }
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            );
          })}
          <div className="flex gap-2 pt-2">
            {authLoading ? null : isSignedIn ? (
              <Link
                href={profile?.role === "teacher" ? TEACHER_PORTAL_CLASSROOMS_URL : "/home"}
                className={
                  isDark
                    ? "rounded-full bg-[#34f5a4] px-4 py-2 text-sm font-semibold text-neutral-950 flex-1 text-center"
                    : "bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm font-medium flex-1 text-center"
                }
                onClick={() => setMobileOpen(false)}
              >
                Open app
              </Link>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    if (onOpenSignInNotice) {
                      onOpenSignInNotice();
                    } else {
                      handleWaitlist();
                    }
                  }}
                  className={
                    isDark
                      ? "rounded-full border border-white/20 px-4 py-2 text-sm text-zinc-200 flex-1 text-center cursor-pointer"
                      : "border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-500 flex-1 text-center cursor-pointer"
                  }
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleWaitlist();
                  }}
                  className={
                    isDark
                      ? "rounded-full bg-[#34f5a4] px-4 py-2 text-sm font-semibold text-neutral-950 flex-1 text-center cursor-pointer"
                      : "bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm font-medium flex-1 text-center cursor-pointer"
                  }
                >
                  Join Now
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
