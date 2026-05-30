"use client";

import { useState, useEffect } from "react";
import { FileText, LayoutTemplate } from "lucide-react";
import { resolvePostHtml } from "../resolve-post-html";
import type { Post } from "../types";
import { ArticleTextBody } from "./ArticleTextBody";
import { HtmlBodyFrame } from "./HtmlBodyFrame";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { ArticleOnboardingTracker } from "./ArticleOnboardingTracker";

export function ArticlePageContent({
  post,
  isAdmin: isAdminFromServer = false,
}: {
  post: Post;
  isAdmin?: boolean;
}) {
  const isAdminClient = useIsAppAdmin();
  const isAdmin = isAdminFromServer || isAdminClient;
  const rawHtml = resolvePostHtml(post);
  const [viewMode, setViewMode] = useState<"rendered" | "text">(rawHtml ? "rendered" : "text");

  const showPageHeader = !rawHtml || viewMode === "text";
  const canToggle = Boolean(rawHtml);

  return (
    <>
      <ArticleOnboardingTracker />
      {showPageHeader ? (
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {post.title}
        </h1>
      ) : (
        <h1 className="sr-only">{post.title}</h1>
      )}

      <div className={showPageHeader ? "mt-6" : "mt-2"}>
        {!rawHtml || viewMode === "text" ? (
          <ArticleTextBody post={post} isAdmin={isAdmin} />
        ) : (
          <div className="overflow-visible rounded-xl border border-emerald-500/25 bg-[#0f1826] [overflow-anchor:none]">
            <HtmlBodyFrame html={rawHtml} title={post.title} minHeight={200} />
          </div>
        )}
      </div>

      {canToggle ? (
        <footer className="mt-8 flex justify-center border-t border-slate-600/25 pt-6">
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === "rendered" ? "text" : "rendered"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-950/25 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-500/60 hover:bg-emerald-900/35"
          >
            {viewMode === "rendered" ? (
              <>
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                View text
              </>
            ) : (
              <>
                <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
                View formatted
              </>
            )}
          </button>
        </footer>
      ) : null}
    </>
  );
}
