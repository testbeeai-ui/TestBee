import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/integrations/supabase/server";
import { isAdminOnlyNewsSection } from "@/app/news-blog/constants";
import { isAdminUser } from "@/lib/admin";
import { getPublicPostsServer } from "@/lib/news-blog/server-loader";
import { NewsBlogClient } from "./NewsBlogClient";
import { NewsBlogSeoIndex } from "./components/NewsBlogSeoIndex";
import { PublicShell } from "./PublicShell";
import {
  normalizeListNav,
  parseListNavFromSearchParams,
  searchParamsFromNext,
} from "./nav-query";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "News & Blogs · EduBlast",
  description:
    "Exam buzz, key dates, results, topper stories, study tips, and revision playbooks for JEE, board exams, and state CET — free to read on EduBlast.",
  openGraph: {
    title: "News & Blogs · EduBlast",
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

async function getIsAppAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return isAdminUser(supabase, user.id);
}

function postsVisibleToUser<T extends { portal: string; section: string }>(
  posts: T[],
  isAdmin: boolean
): T[] {
  if (isAdmin) return posts;
  return posts.filter((p) => p.portal !== "news" || !isAdminOnlyNewsSection(p.section));
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewsBlogPage({ searchParams }: PageProps) {
  const [allPosts, isLoggedIn, isAdmin, query] = await Promise.all([
    getPublicPostsServer(),
    getIsLoggedIn(),
    getIsAppAdmin(),
    searchParams,
  ]);
  const posts = postsVisibleToUser(allPosts, isAdmin);
  const initialNav = normalizeListNav(parseListNavFromSearchParams(searchParamsFromNext(query)), {
    isAdmin,
  });

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
