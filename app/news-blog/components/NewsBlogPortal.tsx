"use client";

import Link from "next/link";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  Filter,
  LayoutTemplate,
  ListOrdered,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { deletePost as dbDeletePost } from "@/lib/news-blog/news-blog-db";
import {
  BLOG_SECTIONS,
  EXAMS,
  getAdminPreviewNewsSections,
  getPublicNewsSections,
  KEY_DATE_SIDEBAR_ACCENTS,
  NEWS_SECTIONS,
} from "../constants";
import { examBrowsePillClass } from "../exam-pill-styles";
import {
  feedCardBlurb,
  formatKeyDateEndBadge,
  formatLinkHostDisplay,
  keyDatesFeedBlurb,
} from "../html-feed-and-seo";
import { formatDdMonYyyy, formatRelativeNewsTime } from "../key-date-time";
import { getExamLabel, getSectionLabel, revisionPlanDisplayLabel } from "../post-draft-utils";
import type { BlogSection, ExamId, NewsSection, Portal, Post, SectionId } from "../types";
import { HtmlBodyFrame } from "./HtmlBodyFrame";
import { HtmlPlainDocumentView } from "./HtmlPlainDocumentView";
import { KeyDateSidebarCountdownCard } from "./KeyDateSidebarCountdownCard";
import { KeyDatesPostRow } from "./KeyDatesPostRow";
import { PostImages } from "./PostImages";
import { RevisionPlaybookStrip } from "./RevisionPlaybookStrip";
import { getSectionIcon } from "../section-icons";

export interface NewsBlogPortalProps {
  getPostHref: (post: Post) => string;
  portal: Portal;
  activeExamFilter: ExamId;
  activeSection: SectionId;
  setNewsExamFilter: Dispatch<SetStateAction<ExamId>>;
  setBlogExamFilter: Dispatch<SetStateAction<ExamId>>;
  setNewsSection: Dispatch<SetStateAction<NewsSection>>;
  setBlogSection: Dispatch<SetStateAction<BlogSection>>;
  openPost: Post | null;
  goToPost: (id: string | null) => void;
  loading: boolean;
  visiblePosts: Post[];
  featuredPost: Post | undefined;
  secondaryPosts: Post[];
  isKeyDatesPortalView: boolean;
  isBlastPortalView: boolean;
  isAdmin: boolean;
  startEditPost: (p: Post) => void;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setEditingPostId: Dispatch<SetStateAction<string | null>>;
  removeDeletedFromEditorPicks: (deletedId: string) => void;
  nearestKeyDatesSidebar: Post[];
  latestNewsSidebar: Post[];
  blogPosts: Post[];
  editorPickResolvedPosts: [Post | null, Post | null, Post | null];
  editorPicksPanelOpen: boolean;
  setEditorPicksPanelOpen: Dispatch<SetStateAction<boolean>>;
  sectionCounts: Map<SectionId, number>;
  assignPostToEditorPickSlot: (postId: string, slot: 0 | 1 | 2) => void;
  slotMenuForPostId: string | null;
  setSlotMenuForPostId: Dispatch<SetStateAction<string | null>>;
  editorPickIds: [string | null, string | null, string | null];
  currentPage: number;
  totalPages: number;
  showPaginationNav: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function NewsBlogPortal(props: NewsBlogPortalProps) {
  const {
    getPostHref,
    portal,
    activeExamFilter,
    activeSection,
    setNewsExamFilter,
    setBlogExamFilter,
    setNewsSection,
    setBlogSection,
    openPost,
    goToPost,
    loading,
    visiblePosts,
    featuredPost,
    secondaryPosts,
    isKeyDatesPortalView,
    isBlastPortalView,
    isAdmin,
    startEditPost,
    setPosts,
    setEditingPostId,
    removeDeletedFromEditorPicks,
    nearestKeyDatesSidebar,
    latestNewsSidebar,
    blogPosts,
    editorPickResolvedPosts,
    editorPicksPanelOpen,
    setEditorPicksPanelOpen,
    sectionCounts,
    assignPostToEditorPickSlot,
    slotMenuForPostId,
    setSlotMenuForPostId,
    editorPickIds,
    currentPage,
    totalPages,
    showPaginationNav,
    onPrevPage,
    onNextPage,
  } = props;

  const publicNewsSections = getPublicNewsSections();
  const adminPreviewNewsSections = isAdmin ? getAdminPreviewNewsSections() : [];

  const [openPostHtmlViewMode, setOpenPostHtmlViewMode] = useState<"rendered" | "text">("rendered");
  useEffect(() => {
    setOpenPostHtmlViewMode("rendered");
  }, [openPost?.id]);

  const blogEditorPickSlotButton = (post: Post, compact: boolean) => {
    if (!isAdmin) return null;
    if (portal !== "blog") return null;
    const menuOpen = slotMenuForPostId === post.id;
    const btnPad = compact ? "h-7 w-7" : "h-8 w-8";
    return (
      <div className="relative">
        <button
          type="button"
          title="Editor pick slots - choose 1, 2, or 3"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSlotMenuForPostId(menuOpen ? null : post.id);
          }}
          className={
            "inline-flex shrink-0 items-center justify-center rounded-md border border-violet-500/35 bg-violet-950/25 text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-900/35 " +
            btnPad
          }
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <ListOrdered className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </button>
        {menuOpen ? (
          <div
            className={
              "absolute z-[130] flex min-w-[6.5rem] flex-col gap-0.5 rounded-lg border border-slate-600/50 bg-[#1a2434] p-1 shadow-xl ring-1 ring-black/30 " +
              (compact ? "bottom-full right-0 mb-1" : "bottom-full right-0 mb-1.5")
            }
            role="menu"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <p className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
              Slot
            </p>
            {([0, 1, 2] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                role="menuitem"
                onClick={() => assignPostToEditorPickSlot(post.id, slot)}
                className="rounded px-2 py-1 text-left text-[11px] font-medium text-slate-200 hover:bg-violet-600/25"
              >
                {slot + 1}
                {editorPickIds[slot] === post.id ? (
                  <span className="ml-1 text-emerald-400">{"\u2713"}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-600/20 bg-[#141d2c]/95 px-3 py-2 backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-2.5">
        <span className="mr-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:gap-1.5">
          <Filter className="h-3 w-3 text-slate-600 sm:h-3.5 sm:w-3.5" /> Exam
        </span>
        {EXAMS.map((exam) => {
          const selected = activeExamFilter === exam.id;
          return (
            <button
              key={exam.id}
              type="button"
              onClick={() => {
                if (portal === "news") setNewsExamFilter(exam.id);
                else setBlogExamFilter(exam.id);
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:py-1.5 sm:text-xs ${
                selected
                  ? portal === "news"
                    ? "border-sky-500/50 bg-sky-950/40 text-sky-200 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]"
                    : "border-violet-500/50 bg-violet-950/40 text-violet-200 shadow-[0_0_0_1px_rgba(167,139,250,0.12)]"
                  : "border-slate-600/35 bg-[#1a2434] text-slate-300 hover:border-slate-500 hover:text-slate-100"
              }`}
            >
              {exam.label}
            </button>
          );
        })}
      </div>

      <div className="flex overflow-x-auto gap-0.5 border-b border-slate-600/20 bg-[#131d2c]/95 px-2 pb-1 scrollbar-none sm:flex-wrap sm:gap-1 sm:px-4">
        {(portal === "news" ? publicNewsSections : BLOG_SECTIONS).map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                if (portal === "news") setNewsSection(section.id as NewsSection);
                else setBlogSection(section.id as BlogSection);
              }}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-2.5 py-2 text-[12px] font-medium transition sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                isActive
                  ? portal === "news"
                    ? "bg-[#0f2840]/90 text-sky-100 shadow-[inset_0_-2px_0_0_rgba(56,189,248,0.65)]"
                    : "bg-[#1a1530]/90 text-violet-100 shadow-[inset_0_-2px_0_0_rgba(167,139,250,0.6)]"
                  : "text-slate-400 hover:bg-slate-500/10 hover:text-slate-200"
              }`}
            >
              {getSectionIcon(section.id)}
              {section.label}
            </button>
          );
        })}
        {portal === "news"
          ? adminPreviewNewsSections.map((section) => (
              <span
                key={section.id}
                title="Coming soon"
                className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-t-lg px-2.5 py-2 text-[12px] font-medium text-slate-500 opacity-70 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                aria-disabled="true"
              >
                {getSectionIcon(section.id)}
                <span>{section.label}</span>
                <span className="rounded-full border border-slate-600/50 bg-slate-800/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Soon
                </span>
              </span>
            ))
          : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="lg:border-r border-slate-600/20 bg-[#121a28]/95 p-3 sm:p-4 lg:p-5">
          {openPost ? (
            <article className="overflow-hidden rounded-xl border border-slate-600/35 bg-gradient-to-b from-[#1e2d42] to-[#161f2e] shadow-xl shadow-black/20 sm:rounded-2xl">
              <div className="p-4 sm:p-5 lg:p-7">
                <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
                  <button
                    type="button"
                    onClick={() => goToPost(null)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-800/40 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800/70 sm:px-3 sm:text-xs"
                  >
                    <ArrowLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Back to posts
                  </button>
                  <time
                    className="text-[11px] tabular-nums text-slate-500 sm:text-xs"
                    dateTime={openPost.createdAt}
                  >
                    {formatDdMonYyyy(openPost.createdAt)}
                  </time>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] sm:mb-5 sm:gap-2 sm:text-xs">
                  <span className="rounded-full bg-[#0d1e30] px-2.5 py-0.5 font-medium text-blue-200/95">
                    {getExamLabel(openPost.exam)}
                  </span>
                  <span className="rounded-full bg-[#171425] px-2.5 py-0.5 font-medium text-violet-200/95">
                    {getSectionLabel(openPost.section)}
                  </span>
                  {openPost.section === "blast" && openPost.revisionPlan ? (
                    <span className="rounded-full border border-rose-500/40 bg-rose-950/40 px-2.5 py-0.5 font-medium text-rose-100/90">
                      {revisionPlanDisplayLabel(openPost.revisionPlan)}
                    </span>
                  ) : null}
                </div>
                {openPost.section === "ndates" ? (
                  <div className="mx-auto flex max-w-3xl gap-3 sm:gap-4">
                    <div className="flex min-w-[4rem] shrink-0 flex-col rounded-lg border border-slate-600/60 bg-[#1a2233] px-2.5 py-2 sm:min-w-[4.5rem] sm:px-3 sm:py-2.5">
                      <span className="text-[13px] font-semibold leading-none text-sky-400 sm:text-sm">
                        {formatKeyDateEndBadge(openPost.examDate)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold leading-snug tracking-tight text-slate-50 sm:text-lg lg:text-2xl">
                        {openPost.title}
                      </h2>
                      <p className="mt-2 text-[13px] leading-relaxed text-slate-400 sm:mt-3 sm:text-sm">
                        <span className="text-slate-300">{keyDatesFeedBlurb(openPost) || "-"}</span>
                        {openPost.sourceLink ? (
                          <>
                            <span className="text-slate-600"> · </span>
                            <span className="text-slate-500">
                              {formatLinkHostDisplay(openPost.sourceLink)}
                            </span>
                          </>
                        ) : null}
                      </p>
                      {openPost.summary.trim() && openPost.body.trim() ? (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-[1.7] text-slate-300 sm:mt-5 sm:text-base sm:leading-[1.75]">
                          {openPost.body}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : openPost.section === "btoppers" ? (
                  <div
                    className={`mx-auto ${
                      openPost.contentFormat === "html" &&
                      openPost.rawHtml.trim() &&
                      openPostHtmlViewMode === "rendered"
                        ? "max-w-3xl md:max-w-4xl lg:max-w-none"
                        : "max-w-3xl"
                    }`}
                  >
                    {openPost.contentFormat === "html" && openPost.rawHtml.trim() ? (
                      openPostHtmlViewMode === "text" ? (
                        <div className="mx-auto max-w-3xl">
                          <HtmlPlainDocumentView
                            variant="article"
                            showSeoCallout={false}
                            source={{
                              title: openPost.title,
                              summary: openPost.summary,
                              body: openPost.body,
                              rawHtml: openPost.rawHtml,
                              author: openPost.author,
                              publishDate: openPost.publishDate,
                              createdAt: openPost.createdAt,
                              heroImageUrl: openPost.heroImageUrl,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-[#0f1826]">
                          <HtmlBodyFrame
                            key={`${openPost.id}-open-html-btoppers`}
                            html={openPost.rawHtml}
                            title={openPost.title}
                          />
                        </div>
                      )
                    ) : (
                      <>
                        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:mb-4">
                          <h2 className="text-base font-semibold leading-[1.18] tracking-tight text-slate-50 sm:text-xl lg:text-[1.85rem]">
                            {openPost.title}
                          </h2>
                          <span className="text-base font-medium text-sky-300 sm:text-lg">
                            {openPost.role}
                          </span>
                        </div>
                        <blockquote className="my-4 border-l-2 border-sky-500/50 pl-4 text-sm italic leading-relaxed text-slate-300 sm:my-5 sm:pl-5 sm:text-base">
                          &ldquo;{openPost.summary}&rdquo;
                        </blockquote>
                        <div className="prose prose-invert mt-5 max-w-none space-y-3 text-sm leading-[1.7] text-slate-300 sm:mt-6 sm:space-y-4 sm:text-base sm:leading-[1.75]">
                          {openPost.body
                            .split("\n")
                            .filter((line) => line.trim())
                            .map((line, idx) => (
                              <p key={idx} className="whitespace-pre-wrap">
                                {line}
                              </p>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    className={`mx-auto ${
                      openPost.contentFormat === "html" &&
                      openPost.rawHtml.trim() &&
                      openPostHtmlViewMode === "rendered"
                        ? "max-w-3xl md:max-w-4xl lg:max-w-none"
                        : "max-w-3xl"
                    }`}
                  >
                    {openPost.contentFormat === "html" && openPost.rawHtml.trim() ? (
                      openPostHtmlViewMode === "text" ? (
                        <div className="mx-auto max-w-3xl">
                          <HtmlPlainDocumentView
                            variant="article"
                            showSeoCallout={false}
                            source={{
                              title: openPost.title,
                              summary: openPost.summary,
                              body: openPost.body,
                              rawHtml: openPost.rawHtml,
                              author: openPost.author,
                              publishDate: openPost.publishDate,
                              createdAt: openPost.createdAt,
                              heroImageUrl: openPost.heroImageUrl,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-[#0f1826]">
                          <HtmlBodyFrame
                            key={`${openPost.id}-open-html`}
                            html={openPost.rawHtml}
                            title={openPost.title}
                          />
                        </div>
                      )
                    ) : (
                      <>
                        <h2 className="text-base font-semibold leading-[1.18] tracking-tight text-slate-50 sm:text-xl lg:text-[1.85rem]">
                          {openPost.title}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:mt-4 sm:text-base">
                          {openPost.summary.trim() || feedCardBlurb(openPost)}
                        </p>
                        <div className="prose prose-invert mt-5 max-w-none sm:mt-6">
                          <p className="whitespace-pre-wrap text-sm leading-[1.7] text-slate-300 sm:text-base sm:leading-[1.75]">
                            {openPost.body}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-700/50 pt-4 text-[11px] text-slate-500 sm:mt-8 sm:gap-3 sm:pt-5 sm:text-xs">
                  <span className="min-w-0 flex-1">
                    {openPost.author.trim() || openPost.role.trim() ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <User className="h-3.5 w-3.5 shrink-0 text-slate-500" />{" "}
                        <span className="text-slate-300">{openPost.author}</span>
                        {openPost.role ? (
                          <span className="text-slate-500"> · {openPost.role}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span />
                    )}
                  </span>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {openPost.contentFormat === "html" && openPost.rawHtml.trim() ? (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={() =>
                          setOpenPostHtmlViewMode((m) => (m === "rendered" ? "text" : "rendered"))
                        }
                        className="relative z-10 inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-600/40 bg-emerald-950/20 px-2 py-1.5 text-[11px] font-medium text-emerald-200 transition hover:border-emerald-500/60 hover:bg-emerald-900/30"
                      >
                        {openPostHtmlViewMode === "rendered" ? (
                          <>
                            <FileText className="h-3 w-3 shrink-0" aria-hidden /> View text
                          </>
                        ) : (
                          <>
                            <LayoutTemplate className="h-3 w-3 shrink-0" aria-hidden /> View
                            formatted
                          </>
                        )}
                      </button>
                    ) : null}
                    {openPost.portal === "blog" ? blogEditorPickSlotButton(openPost, false) : null}
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditPost(openPost)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1.5 text-sky-300 transition hover:border-sky-500/80 hover:bg-sky-950/30"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await dbDeletePost(openPost.id);
                            removeDeletedFromEditorPicks(openPost.id);
                            setPosts((prev) => prev.filter((p) => p.id !== openPost.id));
                            setEditingPostId((cur) => (cur === openPost.id ? null : cur));
                            goToPost(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1.5 text-rose-300 transition hover:border-rose-500/80 hover:bg-rose-950/25"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {openPost.sourceLink ? (
                  <div className="mt-6 border-t border-slate-700/50 pt-5">
                    <a
                      href={openPost.sourceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-sky-400 underline decoration-sky-500/35 underline-offset-4 transition hover:text-sky-300"
                    >
                      Official link
                    </a>
                  </div>
                ) : null}
              </div>
            </article>
          ) : (
            <>
              <div
                className={`mb-3 rounded-xl border p-3 shadow-inner sm:mb-4 sm:rounded-2xl sm:p-4 ${
                  portal === "news"
                    ? "border-sky-500/20 bg-sky-950/10"
                    : "border-violet-500/20 bg-violet-950/10"
                }`}
              >
                <div className="mb-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-white sm:gap-2 sm:text-sm">
                  {getSectionIcon(activeSection)}
                  {getSectionLabel(activeSection)}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400 sm:text-xs">
                  {
                    (portal === "news" ? NEWS_SECTIONS : BLOG_SECTIONS).find(
                      (s) => s.id === activeSection
                    )?.desc
                  }
                </p>
              </div>

              {isBlastPortalView ? <RevisionPlaybookStrip /> : null}

              {loading ? (
                <div className="rounded-xl border border-slate-600/30 bg-[#1a2434] p-8 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-500 animate-pulse" />
                  <p className="text-sm font-semibold text-slate-200">Loading posts...</p>
                </div>
              ) : visiblePosts.length === 0 ? (
                <div className="rounded-xl border border-slate-600/30 bg-[#1a2434] p-8 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-200">
                    No posts yet in this section
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Use <span className="font-semibold text-emerald-300">Add post</span> to create a
                    new post (saved locally).
                  </p>
                </div>
              ) : isKeyDatesPortalView ? (
                <div className="overflow-hidden rounded-xl border border-slate-600/30 bg-[#1a2434] px-2">
                  {visiblePosts.map((p) => (
                    <KeyDatesPostRow
                      key={p.id}
                      post={p}
                      href={getPostHref(p)}
                      isAdmin={isAdmin}
                      onEdit={startEditPost}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {featuredPost ? (
                    <Link
                      href={getPostHref(featuredPost)}
                      className="group block cursor-pointer overflow-hidden rounded-xl border border-slate-600/35 bg-gradient-to-br from-[#1e2d42] via-[#1a2635] to-[#161f2e] shadow-lg shadow-black/15 transition-colors duration-200 hover:border-emerald-500/35 sm:rounded-2xl"
                    >
                      <article>
                        <div className="p-4 sm:p-5 lg:p-7">
                          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] sm:mb-4 sm:gap-2 sm:text-xs">
                            <span className="rounded-full bg-[#0d1e30] px-2 py-0.5 font-medium text-blue-200/95 sm:px-2.5">
                              {getExamLabel(featuredPost.exam)}
                            </span>
                            <span className="rounded-full bg-[#171425] px-2 py-0.5 font-medium text-violet-200/95 sm:px-2.5">
                              {getSectionLabel(featuredPost.section)}
                            </span>
                            {featuredPost.section === "blast" && featuredPost.revisionPlan ? (
                              <span className="rounded-full border border-rose-500/40 bg-rose-950/35 px-2 py-0.5 font-medium text-rose-100/90 sm:px-2.5">
                                {revisionPlanDisplayLabel(featuredPost.revisionPlan)}
                              </span>
                            ) : null}
                            <time
                              className="ml-auto tabular-nums text-slate-500"
                              dateTime={featuredPost.createdAt}
                            >
                              {formatDdMonYyyy(featuredPost.createdAt)}
                            </time>
                          </div>
                          <h3 className="text-lg font-semibold leading-tight tracking-tight text-slate-50 sm:text-xl lg:text-3xl">
                            {featuredPost.title}
                          </h3>
                          {(() => {
                            const lead = featuredPost.summary.trim() || feedCardBlurb(featuredPost);
                            const teaser =
                              featuredPost.contentFormat !== "html" ? featuredPost.body.trim() : "";
                            if (
                              featuredPost.contentFormat === "html" &&
                              featuredPost.rawHtml.trim()
                            ) {
                              return lead ? (
                                <p className="mt-2.5 text-sm leading-relaxed text-slate-300 sm:mt-3 sm:text-base">
                                  {lead}
                                </p>
                              ) : null;
                            }
                            return (
                              <>
                                {lead ? (
                                  <p className="mt-2.5 line-clamp-4 text-sm leading-relaxed text-slate-300 sm:mt-3 sm:text-base">
                                    {lead}
                                  </p>
                                ) : null}
                                <PostImages
                                  heroImageUrl={featuredPost.heroImageUrl}
                                  inlineImageUrl={featuredPost.inlineImageUrl}
                                  heroImageCaption={featuredPost.heroImageCaption}
                                  inlineImageCaption={featuredPost.inlineImageCaption}
                                />
                                {teaser ? (
                                  <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-slate-400 sm:mt-3 sm:text-sm">
                                    {teaser}
                                  </p>
                                ) : null}
                              </>
                            );
                          })()}
                          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-700/50 pt-3 text-[11px] text-slate-500 sm:mt-5 sm:gap-3 sm:pt-4 sm:text-xs">
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <span className="hidden items-center gap-1 text-[11px] font-semibold text-emerald-300/95 sm:inline-flex">
                                Read <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                              </span>
                              {portal === "blog"
                                ? blogEditorPickSlotButton(featuredPost, false)
                                : null}
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      startEditPost(featuredPost);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1.5 text-sky-300 transition hover:border-sky-500/80 hover:bg-sky-950/25"
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      await dbDeletePost(featuredPost.id);
                                      removeDeletedFromEditorPicks(featuredPost.id);
                                      setEditingPostId((cur) =>
                                        cur === featuredPost.id ? null : cur
                                      );
                                      setPosts((prev) =>
                                        prev.filter((p) => p.id !== featuredPost.id)
                                      );
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1.5 text-rose-300 transition hover:border-rose-500/80 hover:bg-rose-950/25"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ) : null}

                  {secondaryPosts.length > 0 ? (
                    <div className="grid gap-2.5 md:grid-cols-2 lg:gap-3">
                      {secondaryPosts.map((post) => (
                        <Link
                          key={post.id}
                          href={getPostHref(post)}
                          className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-slate-600/30 bg-[#1a2434] transition-colors duration-200 hover:border-sky-500/30 sm:rounded-xl"
                        >
                          <article className="flex flex-1 flex-col">
                            <div className="flex flex-1 flex-col p-3 sm:p-4">
                              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] sm:mb-3 sm:gap-2 sm:text-[11px]">
                                <span className="rounded-full bg-[#0d1e30] px-1.5 py-0.5 font-medium text-blue-200/95 sm:px-2">
                                  {getExamLabel(post.exam)}
                                </span>
                                <span className="rounded-full bg-[#171425] px-1.5 py-0.5 font-medium text-violet-200/95 sm:px-2">
                                  {getSectionLabel(post.section)}
                                </span>
                                {post.section === "blast" && post.revisionPlan ? (
                                  <span className="rounded-full border border-rose-500/40 bg-rose-950/30 px-1.5 py-0.5 font-medium text-rose-100/90 sm:px-2">
                                    {revisionPlanDisplayLabel(post.revisionPlan)}
                                  </span>
                                ) : null}
                                <time
                                  className="ml-auto tabular-nums text-slate-500"
                                  dateTime={post.createdAt}
                                >
                                  {formatDdMonYyyy(post.createdAt)}
                                </time>
                              </div>
                              <h4 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-slate-50 sm:text-base lg:text-lg">
                                {post.title}
                              </h4>
                              {post.heroImageUrl.trim() ? (
                                <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-700/60 bg-[#101a2a] sm:mt-3">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={post.heroImageUrl}
                                    alt={post.heroImageCaption || post.title}
                                    className="h-24 w-full object-cover sm:h-28 lg:h-32"
                                  />
                                </div>
                              ) : null}
                              {(() => {
                                const blurb = feedCardBlurb(post);
                                return blurb ? (
                                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-400 sm:mt-2 sm:text-sm">
                                    {blurb}
                                  </p>
                                ) : null;
                              })()}
                            </div>
                            <div className="flex items-center justify-end gap-1.5 border-t border-slate-600/25 px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5">
                              {portal === "blog" ? blogEditorPickSlotButton(post, true) : null}
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      startEditPost(post);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-sky-300 transition hover:border-sky-500/70 hover:bg-sky-950/20"
                                  >
                                    <Pencil className="h-3 w-3" /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      await dbDeletePost(post.id);
                                      removeDeletedFromEditorPicks(post.id);
                                      setEditingPostId((cur) => (cur === post.id ? null : cur));
                                      setPosts((prev) => prev.filter((p) => p.id !== post.id));
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-rose-300 transition hover:border-rose-500/70 hover:bg-rose-950/20"
                                  >
                                    <Trash2 className="h-3 w-3" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </article>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {showPaginationNav ? (
                    <nav
                      aria-label="Posts pagination"
                      className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-600/30 bg-[#1a2434]/80 px-3 py-2 text-[12px] text-slate-300 sm:mt-3 sm:px-4 sm:py-2.5 sm:text-sm"
                    >
                      <button
                        type="button"
                        onClick={onPrevPage}
                        disabled={currentPage <= 1}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-[#1f2a3d] px-2.5 py-1.5 font-medium text-slate-200 transition hover:border-sky-500/50 hover:bg-sky-950/30 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-600/60 disabled:hover:bg-[#1f2a3d] disabled:hover:text-slate-200 sm:px-3 sm:py-2"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                        Previous
                      </button>
                      <span className="text-[11px] tabular-nums text-slate-400 sm:text-xs">
                        Page <span className="font-semibold text-slate-100">{currentPage}</span> of{" "}
                        <span className="font-semibold text-slate-100">{totalPages}</span>
                      </span>
                      <button
                        type="button"
                        onClick={onNextPage}
                        disabled={currentPage >= totalPages}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-[#1f2a3d] px-2.5 py-1.5 font-medium text-slate-200 transition hover:border-sky-500/50 hover:bg-sky-950/30 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-600/60 disabled:hover:bg-[#1f2a3d] disabled:hover:text-slate-200 sm:px-3 sm:py-2"
                      >
                        Next
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </nav>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        <aside className="space-y-3 border-t border-slate-600/20 bg-gradient-to-b from-[#151d2c] to-[#121a28] p-3 sm:border-l sm:border-t-0 sm:space-y-4 sm:p-4">
          {portal === "news" ? (
            <>
              <section>
                <h4 className="mb-2 border-b border-slate-600/25 pb-1 text-sm font-semibold text-slate-100">
                  Key dates
                </h4>
                <div className="space-y-1.5">
                  {nearestKeyDatesSidebar.map((p, i) => (
                    <KeyDateSidebarCountdownCard
                      key={p.id}
                      post={p}
                      href={getPostHref(p)}
                      accent={KEY_DATE_SIDEBAR_ACCENTS[i % KEY_DATE_SIDEBAR_ACCENTS.length]}
                    />
                  ))}
                  {nearestKeyDatesSidebar.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-600/40 bg-[#101a2a] p-3 text-xs leading-relaxed text-slate-500">
                      Add Key dates with an end date to see the three nearest deadlines here.
                    </p>
                  ) : null}
                </div>
              </section>
              <section>
                <h4 className="mb-2 border-b border-slate-600/25 pb-1 text-sm font-semibold text-slate-100">
                  Latest news
                </h4>
                <div className="space-y-2">
                  {latestNewsSidebar.map((p) => (
                    <Link
                      key={p.id}
                      href={getPostHref(p)}
                      className="flex w-full gap-2.5 rounded-lg border border-slate-600/30 bg-[#182233] p-2.5 text-left transition hover:border-sky-500/25 hover:bg-[#1e2a3d]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-600/40 bg-[#1a2434] text-slate-400">
                        {getSectionIcon(p.section)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-medium leading-snug text-slate-100">
                          {p.title}
                        </p>
                        {(() => {
                          const b = feedCardBlurb(p);
                          return b ? (
                            <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500">
                              {b}
                            </p>
                          ) : null;
                        })()}
                        <p className="mt-1 text-[11px] text-slate-500">
                          {formatRelativeNewsTime(p.createdAt)} · {getExamLabel(p.exam)}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {latestNewsSidebar.length === 0 ? (
                    <p className="text-xs text-slate-500">No news posts yet.</p>
                  ) : null}
                </div>
              </section>
              <section>
                <h4 className="mb-2 border-b border-slate-600/25 pb-1 text-sm font-semibold text-slate-100">
                  Browse by exam
                </h4>
                <div className="flex flex-wrap gap-2">
                  {EXAMS.filter((e) => e.id !== "all").map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setNewsExamFilter(e.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${examBrowsePillClass(e.id)}`}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <>
              <section>
                <h4 className="mb-2 border-b border-slate-600/25 pb-1 text-sm font-semibold text-slate-100">
                  Trending blog posts
                </h4>
                <div className="space-y-2">
                  {blogPosts.slice(0, 3).map((p) => {
                    const blurb = feedCardBlurb(p);
                    return (
                      <div
                        key={p.id}
                        className="rounded-lg border border-slate-600/25 bg-[#182233] p-2 text-xs"
                      >
                        <p className="line-clamp-2 text-slate-200">{p.title}</p>
                        {blurb ? (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">
                            {blurb}
                          </p>
                        ) : null}
                        <p className="mt-1 text-slate-500">{getSectionLabel(p.section)}</p>
                      </div>
                    );
                  })}
                  {blogPosts.length === 0 ? (
                    <p className="text-xs text-slate-500">No blog posts yet.</p>
                  ) : null}
                </div>
              </section>
              <section>
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-600/25 pb-1">
                  <h4 className="text-sm font-semibold text-slate-100">Editor picks</h4>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setEditorPicksPanelOpen((o) => !o)}
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-400 outline-none transition hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-violet-500/40"
                      aria-expanded={editorPicksPanelOpen}
                      title={
                        editorPicksPanelOpen
                          ? "Hide full post list"
                          : "Show all blog posts to assign slots 1-3"
                      }
                    >
                      {editorPicksPanelOpen ? "hide list" : "show list"}
                    </button>
                  ) : null}
                </div>
                {isAdmin && editorPicksPanelOpen ? (
                  <div className="mb-2 max-h-52 overflow-y-auto rounded-lg border border-slate-600/35 bg-[#101a2a] p-2">
                    <p className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Assign to slot 1-3
                    </p>
                    {blogPosts.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-slate-500">No blog posts yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {blogPosts.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-start gap-1.5 rounded-md border border-slate-700/40 bg-[#182233] px-1.5 py-1.5"
                          >
                            <Link
                              href={getPostHref(p)}
                              className="min-w-0 flex-1 text-left text-[11px] font-medium leading-snug text-slate-200 hover:text-white"
                            >
                              <span className="line-clamp-2">{p.title}</span>
                            </Link>
                            <div className="flex shrink-0 gap-0.5">
                              {([0, 1, 2] as const).map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  title={`Slot ${slot + 1}`}
                                  onClick={() => assignPostToEditorPickSlot(p.id, slot)}
                                  className="rounded border border-slate-600/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 hover:border-violet-500/50 hover:bg-violet-950/30 hover:text-violet-100"
                                >
                                  {slot + 1}
                                </button>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                <div className="space-y-2">
                  {([0, 1, 2] as const).map((slot) => {
                    const p = editorPickResolvedPosts[slot];
                    return (
                      <div
                        key={slot}
                        className="rounded-lg border border-slate-600/25 bg-[#182233] p-2 text-xs"
                      >
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Pick {slot + 1}
                        </p>
                        {p ? (
                          <Link href={getPostHref(p)} className="block w-full text-left">
                            <p className="line-clamp-2 text-slate-200">
                              {feedCardBlurb(p) || p.title}
                            </p>
                            <p className="mt-1 text-slate-500">{getSectionLabel(p.section)}</p>
                          </Link>
                        ) : (
                          <p className="text-[11px] leading-relaxed text-slate-500">
                            {isAdmin
                              ? "Empty - use the slot button (123) on a post or the list above."
                              : "-"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              <section>
                <h4 className="mb-2 border-b border-slate-600/25 pb-1 text-sm font-semibold text-slate-100">
                  Blog categories
                </h4>
                <div className="space-y-1 text-sm text-slate-300">
                  {BLOG_SECTIONS.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setBlogSection(s.id)}
                      className="flex w-full items-center justify-between rounded px-1.5 py-1 hover:bg-slate-800/60"
                    >
                      <span>{s.label}</span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs">
                        {sectionCounts.get(s.id) ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
