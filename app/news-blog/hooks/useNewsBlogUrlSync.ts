"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  isBlogSection,
  isNewsSection,
  normalizeListNav,
  parseListNavFromSearchParams,
  serializeListNav,
  type NewsBlogListNav,
} from "../nav-query";
import type { BlogSection, ExamId, NewsSection, Portal } from "../types";

type SyncTargets = {
  portal: Portal;
  setPortal: (p: Portal) => void;
  newsSection: NewsSection;
  setNewsSection: (s: NewsSection) => void;
  blogSection: BlogSection;
  setBlogSection: (s: BlogSection) => void;
  newsExamFilter: ExamId;
  setNewsExamFilter: (e: ExamId) => void;
  blogExamFilter: ExamId;
  setBlogExamFilter: (e: ExamId) => void;
  newsPostPage: number;
  setNewsPostPage: (n: number) => void;
  blogPostPage: number;
  setBlogPostPage: (n: number) => void;
};

export function useNewsBlogUrlSync(targets: SyncTargets): NewsBlogListNav {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const applyingFromUrl = useRef(false);
  const readyToWriteUrl = useRef(false);

  const listNav = useMemo(
    () =>
      normalizeListNav({
        portal: targets.portal,
        section: targets.portal === "news" ? targets.newsSection : targets.blogSection,
        exam: targets.portal === "news" ? targets.newsExamFilter : targets.blogExamFilter,
        page: targets.portal === "news" ? targets.newsPostPage : targets.blogPostPage,
      }),
    [
      targets.portal,
      targets.newsSection,
      targets.blogSection,
      targets.newsExamFilter,
      targets.blogExamFilter,
      targets.newsPostPage,
      targets.blogPostPage,
    ]
  );

  useEffect(() => {
    const fromUrl = parseListNavFromSearchParams(searchParams);
    const hasUrlState =
      fromUrl.portal !== undefined ||
      fromUrl.section !== undefined ||
      fromUrl.exam !== undefined ||
      fromUrl.page !== undefined;
    if (!hasUrlState) {
      readyToWriteUrl.current = true;
      return;
    }

    applyingFromUrl.current = true;
    const portal = fromUrl.portal ?? targets.portal;

    if (fromUrl.portal) targets.setPortal(fromUrl.portal);

    if (fromUrl.section) {
      if (isNewsSection(fromUrl.section)) {
        targets.setNewsSection(fromUrl.section);
        if (!fromUrl.portal) targets.setPortal("news");
      } else if (isBlogSection(fromUrl.section)) {
        targets.setBlogSection(fromUrl.section);
        if (!fromUrl.portal) targets.setPortal("blog");
      }
    }

    if (fromUrl.exam) {
      if (portal === "news") targets.setNewsExamFilter(fromUrl.exam);
      else targets.setBlogExamFilter(fromUrl.exam);
    }

    if (fromUrl.page) {
      if (portal === "news") targets.setNewsPostPage(fromUrl.page);
      else targets.setBlogPostPage(fromUrl.page);
    }

    queueMicrotask(() => {
      applyingFromUrl.current = false;
      readyToWriteUrl.current = true;
    });
  }, [searchParams]);

  useEffect(() => {
    if (!readyToWriteUrl.current || applyingFromUrl.current) return;
    const desired = serializeListNav(listNav);
    if (searchParams.toString() === desired) return;
    router.replace(`${pathname}?${desired}`, { scroll: false });
  }, [listNav, pathname, router, searchParams]);

  return listNav;
}
