import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/integrations/supabase/server";
import { getPublicPostsServer } from "@/lib/news-blog/server-loader";
import { NewsBlogClient } from "./NewsBlogClient";
import { NewsBlogSeoIndex } from "./components/NewsBlogSeoIndex";
import { PublicShell } from "./PublicShell";
import { parseListNavFromSearchParams, searchParamsFromNext } from "./nav-query";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "News & Blog · EduBlast",
  description:
    "Exam buzz, key dates, results, topper stories, study tips, and revision playbooks for JEE, board exams, and state CET — free to read on EduBlast.",
  openGraph: {
    title: "News & Blog · EduBlast",
    description:
      "Latest exam news and preparation blogs for Indian students — JEE, boards, and competitive exams.",
    type: "website",
  },
};

async function getIsLoggedIn(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();
  return Boolean(profile?.onboarding_complete);
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewsBlogPage({ searchParams }: PageProps) {
  const [posts, isLoggedIn, query] = await Promise.all([
    getPublicPostsServer(),
    getIsLoggedIn(),
    searchParams,
  ]);
  const initialNav = parseListNavFromSearchParams(searchParamsFromNext(query));

  return (
    <PublicShell isLoggedIn={isLoggedIn}>
      <NewsBlogSeoIndex posts={posts} />
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-16 text-center text-slate-400">Loading…</div>
        }
      >
        <NewsBlogClient initialPosts={posts} initialNav={initialNav} isLoggedIn={isLoggedIn} />
      </Suspense>
    </PublicShell>
  );
}
