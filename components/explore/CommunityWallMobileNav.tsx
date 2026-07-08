"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { COMMUNITY_WALL_NAV_SECTIONS } from "./communityWallNav";
import { cn } from "@/lib/utils";

function isItemActive(pathname: string, searchParams: URLSearchParams, href: string): boolean {
  if (href.startsWith("#")) return false;
  const [path, query] = href.split("?");
  if (pathname !== path) return false;
  if (!query) {
    const sort = searchParams.get("sort");
    return path === "/explore/community" && (!sort || sort === "latest");
  }
  const expected = new URLSearchParams(query);
  for (const [key, value] of expected.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

/** Horizontal SOCIAL nav for viewports below lg (left rail hidden). */
export default function CommunityWallMobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const social = COMMUNITY_WALL_NAV_SECTIONS.find((s) => s.title === "SOCIAL");
  if (!social) return null;

  return (
    <nav
      className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
      aria-label="Community navigation"
    >
      {social.items.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(pathname, searchParams, item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              active
                ? "border-emerald-600/50 bg-emerald-500/15 text-emerald-300"
                : "border-border/70 bg-card/80 text-muted-foreground hover:text-foreground dark:border-white/10"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
