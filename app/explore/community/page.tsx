"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import RawCommunityFeed, {
  type CommunityFeedPageSize,
  type RawFeedFilter,
} from "@/components/explore/RawCommunityFeed";

function parseFilter(v: string | null): RawFeedFilter | undefined {
  if (v === "all" || v === "physics" || v === "chemistry" || v === "math") return v;
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

function CommunityFeedBody() {
  const searchParams = useSearchParams();
  const initialFilter = parseFilter(searchParams.get("filter"));
  const initialPage = parsePage(searchParams.get("page"));
  const initialPerPage = parsePerPage(searchParams.get("perPage"));
  return (
    <RawCommunityFeed
      mode="full"
      syncPaginationUrl
      initialFilter={initialFilter}
      initialPage={initialPage}
      initialPerPage={initialPerPage}
    />
  );
}

function FeedFallback() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-border p-4 dark:border-white/10"
        >
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExploreCommunityPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4 p-3 sm:p-4 text-sm">
          <header className="space-y-1.5">
            <Link
              href="/explore-1"
              className="inline-flex items-center gap-1 py-0.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              ← Back to Lessons
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Community — your network
            </h1>
            <p className="text-[13px] text-muted-foreground sm:text-sm">
              From your learning network. Use <span className="text-foreground/80">Filters</span> to
              narrow subject and page size; paginate at the bottom.
            </p>
          </header>

          <Suspense fallback={<FeedFallback />}>
            <CommunityFeedBody />
          </Suspense>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
