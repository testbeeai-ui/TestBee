"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { COMMUNITY_WALL_NAV_SECTIONS } from "./communityWallNav";
import {
  COMMUNITY_WALL_LEFT_CONTAINER,
  COMMUNITY_WALL_STICKY_TOP,
  WALL_SIDEBAR_TEXT_CAPTION,
  WALL_SIDEBAR_TEXT_NAV,
} from "./communityWallLayout";
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

export default function CommunityWallSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav
      className={cn(
        "hidden w-full min-w-0 max-w-full shrink-0 lg:block",
        COMMUNITY_WALL_LEFT_CONTAINER
      )}
      aria-label="Community wall navigation"
    >
      <div className={cn("sticky space-y-2.5 @[14rem]/left-rail:space-y-3 @[16rem]/left-rail:space-y-3.5", COMMUNITY_WALL_STICKY_TOP)}>
        {COMMUNITY_WALL_NAV_SECTIONS.map((section, idx) => (
          <div key={section.title}>
            {idx > 0 ? (
              <div className="mb-2 h-px bg-border/70 dark:bg-white/10 @[11rem]/left-rail:mb-2.5" />
            ) : null}
            <h4
              className={cn(
                "mb-1 px-1 text-muted-foreground",
                WALL_SIDEBAR_TEXT_CAPTION
              )}
            >
              {section.title}
            </h4>
            <ul className="space-y-px">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isAnchor = item.href.startsWith("#");
                const active = isItemActive(pathname, searchParams, item.href);
                const cls = cn(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors @[10rem]/left-rail:gap-2 @[10rem]/left-rail:px-2 @[12rem]/left-rail:py-1.5 @[14rem]/left-rail:px-2.5 @[16rem]/left-rail:py-2",
                  WALL_SIDEBAR_TEXT_NAV,
                  active
                    ? "bg-emerald-500/10 font-semibold text-emerald-300"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                );
                return (
                  <li key={item.label}>
                    {isAnchor ? (
                      <a href={item.href} className={cls}>
                        <Icon
                          className="h-3 w-3 shrink-0 @[10rem]/left-rail:h-3.5 @[10rem]/left-rail:w-3.5 @[14rem]/left-rail:h-4 @[14rem]/left-rail:w-4"
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </a>
                    ) : (
                      <Link href={item.href} className={cls}>
                        <Icon
                          className="h-3 w-3 shrink-0 @[10rem]/left-rail:h-3.5 @[10rem]/left-rail:w-3.5 @[14rem]/left-rail:h-4 @[14rem]/left-rail:w-4"
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
