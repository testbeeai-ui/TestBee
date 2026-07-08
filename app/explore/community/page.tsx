"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { cn } from "@/lib/utils";
import CommunityWallSidebar from "@/components/explore/CommunityWallSidebar";
import CommunityWallMobileNav from "@/components/explore/CommunityWallMobileNav";
import {
  COMMUNITY_WALL_GRID,
  COMMUNITY_WALL_MAIN,
  COMMUNITY_WALL_SHELL,
} from "@/components/explore/communityWallLayout";
import CommunityWallHero from "@/components/explore/CommunityWallHero";
import CommunityWallRightSidebar from "@/components/explore/CommunityWallRightSidebar";
import RawPostComposer from "@/components/explore/RawPostComposer";
import RawCommunityFeed, {
  type CommunityFeedPageSize,
  type RawFeedFilter,
  type RawFeedSort,
} from "@/components/explore/RawCommunityFeed";

function parseFilter(v: string | null): RawFeedFilter | undefined {
  if (v === "all" || v === "physics" || v === "chemistry" || v === "math") return v;
  return undefined;
}

function parseSort(v: string | null): RawFeedSort | undefined {
  if (v === "latest" || v === "top" || v === "trending") return v;
  return undefined;
}

function parsePage(v: string | null): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parsePerPage(v: string | null): CommunityFeedPageSize | undefined {
  const n = Number(v);
  if (n === 10 || n === 20 || n === 30 || n === 40) return n;
  return undefined;
}

function CommunityWallBody() {
  const searchParams = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const initialFilter = parseFilter(searchParams.get("filter"));
  const initialSort = parseSort(searchParams.get("sort"));
  const initialPage = parsePage(searchParams.get("page"));
  const initialPerPage = parsePerPage(searchParams.get("perPage"));

  return (
    <div className={COMMUNITY_WALL_SHELL}>
      <CommunityWallMobileNav />
      <div className={cn(COMMUNITY_WALL_GRID, "mt-2.5 sm:mt-3 lg:mt-0")}>
        <CommunityWallSidebar />
        <main className={COMMUNITY_WALL_MAIN}>
          <CommunityWallHero />
          <RawPostComposer onPosted={() => setRefreshKey((k) => k + 1)} />
          <RawCommunityFeed
            mode="full"
            embedded
            syncPaginationUrl
            refreshKey={refreshKey}
            initialFilter={initialFilter}
            initialSort={initialSort}
            initialPage={initialPage}
            initialPerPage={initialPerPage}
          />
          <CommunityWallRightSidebar layout="stack" />
        </main>
        <CommunityWallRightSidebar />
      </div>
    </div>
  );
}

function FeedFallback() {
  return (
    <div className={cn(COMMUNITY_WALL_SHELL, "space-y-2.5 sm:space-y-3")} aria-hidden>
      <div className="h-28 animate-pulse rounded-xl bg-muted sm:h-32 xl:rounded-2xl" />
      <div className="h-12 animate-pulse rounded-xl bg-muted sm:h-14" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

export default function ExploreCommunityPage() {
  return (
    <ProtectedRoute>
      <AppLayout wideMain>
        <Suspense fallback={<FeedFallback />}>
          <CommunityWallBody />
        </Suspense>
      </AppLayout>
    </ProtectedRoute>
  );
}
