"use client";

import { useEffect, useMemo } from "react";
import { addPost as dbAddPost, updatePost as dbUpdatePost } from "@/lib/news-blog-db";
import { sanitizeNewsBlogUploadedHtml } from "@/lib/news-blog-sanitize-html";
import {
  ArrowLeft,
  FileText,
  LayoutTemplate,
  Link2,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Settings,
  User,
  X,
} from "lucide-react";
import {
  BLOG_SECTIONS,
  EXAMS,
  getPublicNewsSections,
  isAdminOnlyNewsSection,
} from "./constants";
import { extractHtmlMeta, formatKeyDateEndBadge, formatLinkHostDisplay } from "./html-feed-and-seo";
import {
  createInitialDraft,
  getExamLabel,
  getSectionLabel,
  publishDateFieldToIso,
  revisionPlanDisplayLabel,
} from "./post-draft-utils";
import type {
  BlogSection,
  Draft,
  ExamId,
  NewsSection,
  Post,
  RevisionPlanId,
  SectionId,
} from "./types";
import { useNewsBlogState } from "./hooks/useNewsBlogState";
import { useNewsBlogUrlSync } from "./hooks/useNewsBlogUrlSync";
import { buildArticleHref, type NewsBlogListNav } from "./nav-query";
import { HtmlBodyFrame } from "./components/HtmlBodyFrame";
import { NewsBlogPortal } from "./components/NewsBlogPortal";
import { HtmlPlainDocumentView } from "./components/HtmlPlainDocumentView";

const POSTS_PER_PAGE = 11;

export function NewsBlogClient({
  initialPosts,
  initialNav,
  isLoggedIn: _isLoggedIn,
}: {
  initialPosts: Post[];
  initialNav?: Partial<NewsBlogListNav>;
  isLoggedIn: boolean;
}) {
  const {
    isAdmin,
    view,
    setView,
    portal,
    setPortal,
    newsExamFilter,
    setNewsExamFilter,
    blogExamFilter,
    setBlogExamFilter,
    newsSection,
    setNewsSection,
    blogSection,
    setBlogSection,
    draft,
    setDraft,
    posts,
    setPosts,
    loading,
    references,
    setReferences,
    referenceLabel,
    setReferenceLabel,
    referenceUrl,
    setReferenceUrl,
    uploadedHtmlFileName,
    setUploadedHtmlFileName,
    openPostId,
    previewHtmlPlain,
    setPreviewHtmlPlain,
    editingPostId,
    setEditingPostId,
    editorPickIds,
    editorPicksPanelOpen,
    setEditorPicksPanelOpen,
    slotMenuForPostId,
    setSlotMenuForPostId,
    blogPostPage,
    setBlogPostPage,
    newsPostPage,
    setNewsPostPage,
    goToPost,
    startEditPost,
    assignPostToEditorPickSlot,
    removeDeletedFromEditorPicks,
  } = useNewsBlogState({ initialPosts, initialNav });

  const composerNewsSections = useMemo(() => getPublicNewsSections(), []);

  useEffect(() => {
    if (draft.portal === "news" && draft.section && isAdminOnlyNewsSection(draft.section)) {
      setDraft((prev) => ({ ...prev, section: "" }));
    }
  }, [draft.portal, draft.section, setDraft]);

  const listNav = useNewsBlogUrlSync({
    isAdmin,
    portal,
    setPortal,
    newsSection,
    setNewsSection,
    blogSection,
    setBlogSection,
    newsExamFilter,
    setNewsExamFilter,
    blogExamFilter,
    setBlogExamFilter,
    newsPostPage,
    setNewsPostPage,
    blogPostPage,
    setBlogPostPage,
  });

  const getPostHref = (post: Post) => buildArticleHref(post, listNav);

  const activeSection = portal === "news" ? newsSection : blogSection;
  const activeExamFilter = portal === "news" ? newsExamFilter : blogExamFilter;

  const visiblePosts = useMemo(() => {
    const filtered = posts
      .filter((p) => p.portal === portal)
      .filter((p) => p.section === activeSection)
      .filter((p) => activeExamFilter === "all" || p.exam === activeExamFilter)
      .filter((p) => isAdmin || p.portal !== "news" || !isAdminOnlyNewsSection(p.section))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return filtered;
  }, [posts, portal, activeSection, activeExamFilter, isAdmin]);

  const storedPage = portal === "news" ? newsPostPage : blogPostPage;
  const setCurrentPage = portal === "news" ? setNewsPostPage : setBlogPostPage;
  const totalPages = Math.max(1, Math.ceil(visiblePosts.length / POSTS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, storedPage), totalPages);
  const paginatedPosts = visiblePosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );
  const showPaginationNav = visiblePosts.length > POSTS_PER_PAGE - 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [portal, activeSection, activeExamFilter, setCurrentPage]);

  useEffect(() => {
    if (storedPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [storedPage, totalPages, setCurrentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => Math.max(1, p - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const { featuredPost, secondaryPosts } = useMemo(() => {
    const list = paginatedPosts;
    if (list.length === 0) {
      return { featuredPost: undefined as Post | undefined, secondaryPosts: [] as Post[] };
    }
    const heroPool = list.filter((p) => p.featured !== "sidebar");
    const hero = heroPool.find((p) => p.featured === "hero") ?? heroPool[0] ?? list[0];
    const secondary = list.filter((p) => p.id !== hero.id);
    return { featuredPost: hero, secondaryPosts: secondary };
  }, [paginatedPosts]);

  const openPost = openPostId
    ? (posts.find((p) => {
        if (p.id !== openPostId) return false;
        return isAdmin || p.portal !== "news" || !isAdminOnlyNewsSection(p.section);
      }) ?? null)
    : null;

  const isKeyDatesDraft = draft.portal === "news" && draft.section === "ndates";
  const isExamBuzzDraft = draft.portal === "news" && draft.section === "nbuzz";
  const isBlastDraft = draft.portal === "blog" && draft.section === "blast";
  const isKeyDatesPortalView = portal === "news" && activeSection === "ndates";
  const showComposerHtmlPreview =
    !isKeyDatesDraft && draft.contentFormat === "html" && draft.rawHtml.trim().length > 0;
  /** HTML tab: markup only; shared meta lives on Write text. */
  const composerHtmlLayoutTab = !isKeyDatesDraft && draft.contentFormat === "html";
  const isBlastPortalView = portal === "blog" && activeSection === "blast";

  /** After chrome strip; Publish button should match what will actually be saved. */
  const sanitizedDraftHtml = useMemo(() => {
    if (!draft.rawHtml.trim()) return "";
    return sanitizeNewsBlogUploadedHtml(draft.rawHtml).trim();
  }, [draft.rawHtml]);

  const sectionCounts = useMemo(() => {
    const counts = new Map<SectionId, number>();
    posts.forEach((p) => counts.set(p.section, (counts.get(p.section) ?? 0) + 1));
    return counts;
  }, [posts]);

  const newsPosts = useMemo(
    () =>
      posts
        .filter((p) => p.portal === "news")
        .filter((p) => isAdmin || !isAdminOnlyNewsSection(p.section))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [posts, isAdmin]
  );

  const blogPosts = useMemo(
    () =>
      posts
        .filter((p) => p.portal === "blog")
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [posts]
  );

  const editorPickResolvedPosts = useMemo(
    () =>
      editorPickIds.map((id) =>
        id ? (posts.find((p) => p.id === id && p.portal === "blog") ?? null) : null
      ) as [Post | null, Post | null, Post | null],
    [posts, editorPickIds]
  );

  /** Up to 3 nearest upcoming Key dates; if none upcoming, show 3 most recent past. */
  const nearestKeyDatesSidebar = useMemo(() => {
    type Row = { post: Post; dayMs: number };
    const rows: Row[] = [];
    for (const p of newsPosts) {
      if (p.section !== "ndates" || !p.examDate.trim()) continue;
      const d = new Date(`${p.examDate}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      rows.push({ post: p, dayMs: d.getTime() });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const t0 = today.getTime();
    const upcoming = rows.filter((r) => r.dayMs >= t0).sort((a, b) => a.dayMs - b.dayMs);
    const picked =
      upcoming.length >= 3
        ? upcoming.slice(0, 3)
        : upcoming.length > 0
          ? upcoming
          : [...rows].sort((a, b) => b.dayMs - a.dayMs).slice(0, 3);
    return picked.map((r) => r.post);
  }, [newsPosts]);

  const latestNewsSidebar = useMemo(() => newsPosts.slice(0, 3), [newsPosts]);

  const publishPost = async () => {
    const keyDatesPost = draft.portal === "news" && draft.section === "ndates";
    const blastPost = draft.portal === "blog" && draft.section === "blast";
    const sanitizedRawHtml = draft.rawHtml.trim()
      ? sanitizeNewsBlogUploadedHtml(draft.rawHtml).trim()
      : "";
    const hasHtml = sanitizedRawHtml.length > 0;
    const bodyTrim = draft.body.trim();

    if (!draft.section) {
      return;
    }
    if (draft.portal === "news" && isAdminOnlyNewsSection(draft.section)) {
      return;
    }
    if (keyDatesPost) {
      if (!draft.title.trim() || !draft.summary.trim()) {
        return;
      }
    } else {
      if (!draft.author.trim()) {
        return;
      }
      if (!hasHtml && !bodyTrim) {
        return;
      }
      if (!draft.title.trim() || !draft.summary.trim()) {
        return;
      }
    }
    if (
      blastPost &&
      draft.revisionPlan !== "180" &&
      draft.revisionPlan !== "60" &&
      draft.revisionPlan !== "3"
    ) {
      return;
    }

    const examBuzzPost = draft.portal === "news" && draft.section === "nbuzz";
    const editingId = editingPostId;
    const existing = editingId ? posts.find((p) => p.id === editingId) : undefined;

    let titleForSave = draft.title.trim();
    const summaryForSave = draft.summary.trim();
    if (hasHtml && !titleForSave) {
      const meta = extractHtmlMeta(sanitizedRawHtml);
      titleForSave = (meta.headline || "HTML article").slice(0, 120);
    }

    const post: Post = {
      id: editingId ?? crypto.randomUUID(),
      portal: draft.portal,
      section: draft.section,
      exam: draft.exam,
      title: titleForSave,
      summary: summaryForSave,
      body: bodyTrim,
      author: draft.author.trim(),
      role: draft.role.trim(),
      examDate: examBuzzPost ? "" : draft.examDate,
      sourceLink: draft.sourceLink.trim(),
      heroImageUrl: "",
      inlineImageUrl: "",
      heroImageCaption: "",
      inlineImageCaption: "",
      revisionPlan: blastPost ? draft.revisionPlan : "",
      featured: draft.featured,
      tags: draft.tags.trim(),
      contentFormat: hasHtml ? "html" : "text",
      rawHtml: hasHtml ? sanitizedRawHtml : "",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      publishDate: publishDateFieldToIso(draft.publishDate),
    };

    try {
      if (editingId) {
        await dbUpdatePost(post);
        setPosts((prev) => prev.map((p) => (p.id === editingId ? post : p)));
      } else {
        await dbAddPost(post);
        setPosts((prev) => [post, ...prev]);
      }

      setEditingPostId(null);

      if (post.portal === "news") {
        setPortal("news");
        setNewsSection(post.section as NewsSection);
        setNewsExamFilter("all");
      } else {
        setPortal("blog");
        setBlogSection(post.section as BlogSection);
        setBlogExamFilter("all");
      }

      setDraft(createInitialDraft());
      setUploadedHtmlFileName("");
      setReferences([]);
      setReferenceLabel("");
      setReferenceUrl("");
      setView("portal");
    } catch (err) {
      console.error("[news-blog] publishPost:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Could not save the post. Confirm you are signed in as an admin and try again."
      );
    }
  };

  const newsExamMetaOk =
    draft.portal !== "news"
      ? true
      : isKeyDatesDraft
        ? draft.examDate.trim().length > 0 && draft.sourceLink.trim().length > 0
        : isExamBuzzDraft
          ? draft.sourceLink.trim().length > 0
          : draft.examDate.trim().length > 0 && draft.sourceLink.trim().length > 0;

  const canPublish =
    !!draft.section &&
    (isKeyDatesDraft
      ? draft.title.trim().length > 0 && draft.summary.trim().length > 0
      : draft.author.trim().length > 0 &&
        draft.title.trim().length > 0 &&
        draft.summary.trim().length > 0 &&
        (sanitizedDraftHtml.length > 0 || draft.body.trim().length > 0) &&
        (isBlastDraft
          ? draft.revisionPlan === "180" ||
            draft.revisionPlan === "60" ||
            draft.revisionPlan === "3"
          : true)) &&
    (draft.portal === "blog" || newsExamMetaOk);

  const openUpload = () => {
    setEditingPostId(null);
    setDraft(createInitialDraft({ portal }));
    setUploadedHtmlFileName("");
    setView("upload");
  };

  const handleHtmlUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const html = typeof reader.result === "string" ? reader.result : "";
      if (!html.trim()) return;
      const cleaned = sanitizeNewsBlogUploadedHtml(html);
      const extracted = extractHtmlMeta(cleaned);
      setUploadedHtmlFileName(file.name);
      setDraft((prev) => ({
        ...prev,
        contentFormat: "html",
        rawHtml: cleaned,
        title: prev.title.trim() ? prev.title : extracted.headline || prev.title,
      }));
    };
    reader.readAsText(file);
  };

  const addReference = () => {
    const label = referenceLabel.trim();
    const url = referenceUrl.trim();
    if (!label && !url) return;
    setReferences((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label,
        url,
      },
    ]);
    setReferenceLabel("");
    setReferenceUrl("");
  };

  return (
        <div className="mx-auto w-full max-w-[1500px] overflow-hidden rounded-2xl border border-slate-600/30 bg-[#151d2e] text-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(148,163,184,0.07)] ring-1 ring-cyan-950/25">
          <div className="flex flex-col border-b border-slate-600/25 bg-gradient-to-r from-[#182536] via-[#141d2c] to-[#182536] sm:flex-row sm:items-stretch">
            <div className="flex min-h-[3.5rem] flex-1 sm:min-h-0">
              <button
                type="button"
                onClick={() => {
                  setPortal("news");
                  setView("portal");
                  goToPost(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2.5 px-3 py-2.5 text-left transition sm:gap-3 sm:px-5 sm:py-3 ${
                  portal === "news"
                    ? "bg-[#0f2840]/95 text-sky-50 shadow-[inset_0_-2px_0_0_rgba(56,189,248,0.75)]"
                    : "text-slate-400 hover:bg-slate-500/10 hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border sm:h-9 sm:w-9 ${
                    portal === "news"
                      ? "border-sky-500/35 bg-sky-500/10 text-sky-300"
                      : "border-slate-600/40 bg-[#1a2434]/70 text-slate-500"
                  }`}
                >
                  <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-tight tracking-tight sm:text-sm">
                    News
                  </span>
                  <span className="mt-0.5 hidden text-[11px] leading-snug text-slate-500 sm:block">
                    Exam buzz · dates · announcements
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPortal("blog");
                  setView("portal");
                  goToPost(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2.5 px-3 py-2.5 text-left transition sm:gap-3 sm:px-5 sm:py-3 ${
                  portal === "blog"
                    ? "bg-[#1a1530]/95 text-violet-50 shadow-[inset_0_-2px_0_0_rgba(167,139,250,0.7)]"
                    : "text-slate-400 hover:bg-slate-500/10 hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border sm:h-9 sm:w-9 ${
                    portal === "blog"
                      ? "border-violet-500/35 bg-violet-500/10 text-violet-300"
                      : "border-slate-600/40 bg-[#1a2434]/70 text-slate-500"
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-tight tracking-tight sm:text-sm">
                    Blogs
                  </span>
                  <span className="mt-0.5 hidden text-[11px] leading-snug text-slate-500 sm:block">
                    Toppers · tips · Mind & Attitude · revision
                  </span>
                </span>
              </button>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openUpload}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 border-t border-slate-600/25 bg-gradient-to-b from-emerald-900/30 to-emerald-950/45 px-3 py-2.5 text-xs font-semibold text-emerald-200 transition hover:from-emerald-800/35 hover:to-emerald-900/50 sm:gap-2 sm:border-l sm:border-t-0 sm:px-5 sm:py-3 sm:text-sm"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Add post
              </button>
            )}
          </div>

          {view === "portal" ? (
            <NewsBlogPortal
              getPostHref={getPostHref}
              portal={portal}
              activeExamFilter={activeExamFilter}
              activeSection={activeSection}
              setNewsExamFilter={setNewsExamFilter}
              setBlogExamFilter={setBlogExamFilter}
              setNewsSection={setNewsSection}
              setBlogSection={setBlogSection}
              openPost={openPost}
              goToPost={goToPost}
              loading={loading}
              visiblePosts={visiblePosts}
              featuredPost={featuredPost}
              secondaryPosts={secondaryPosts}
              isKeyDatesPortalView={isKeyDatesPortalView}
              isBlastPortalView={isBlastPortalView}
              isAdmin={isAdmin}
              startEditPost={startEditPost}
              setPosts={setPosts}
              setEditingPostId={setEditingPostId}
              removeDeletedFromEditorPicks={removeDeletedFromEditorPicks}
              nearestKeyDatesSidebar={nearestKeyDatesSidebar}
              latestNewsSidebar={latestNewsSidebar}
              blogPosts={blogPosts}
              editorPickResolvedPosts={editorPickResolvedPosts}
              editorPicksPanelOpen={editorPicksPanelOpen}
              setEditorPicksPanelOpen={setEditorPicksPanelOpen}
              sectionCounts={sectionCounts}
              assignPostToEditorPickSlot={assignPostToEditorPickSlot}
              slotMenuForPostId={slotMenuForPostId}
              setSlotMenuForPostId={setSlotMenuForPostId}
              editorPickIds={editorPickIds}
              currentPage={currentPage}
              totalPages={totalPages}
              showPaginationNav={showPaginationNav}
              onPrevPage={handlePrevPage}
              onNextPage={handleNextPage}
            />
          ) : (
            <div className="relative border-t border-slate-600/20 bg-[#121a28] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                aria-hidden
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse 85% 55% at 50% -15%, rgba(16,185,129,0.08), transparent 52%), radial-gradient(ellipse 70% 45% at 0% 0%, rgba(56,189,248,0.07), transparent 48%), radial-gradient(ellipse 55% 40% at 100% 10%, rgba(99,102,241,0.06), transparent 50%)",
                }}
              />
              <div className="relative mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPostId(null);
                      setView("portal");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-600/35 bg-[#1a2434]/90 px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-[#223148] hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Composer
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {editingPostId ? "Edit post" : "Add a new post"}
                    </h2>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
                      Draft locally, preview on the right, then publish to the feed.
                    </p>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-950/30 px-3 py-1.5 text-[11px] font-medium text-emerald-300/95">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Saved in local SQLite (localhost demo)
                </span>
              </div>

              <div className="relative grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-6">
                  <section className="rounded-2xl border border-slate-600/30 bg-gradient-to-b from-[#1e2a3d]/96 to-[#151f2d] p-5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.28)] sm:p-6">
                    <div className="mb-5 border-b border-slate-600/20 pb-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Step 1
                      </p>
                      <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
                        Post type & classification
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Choose where this piece lives and who it speaks to.
                      </p>
                    </div>
                    <div
                      className={`mb-4 rounded-xl border p-4 shadow-inner ${
                        draft.portal === "news"
                          ? "border-sky-500/25 bg-sky-950/15"
                          : "border-violet-500/25 bg-violet-950/15"
                      }`}
                    >
                      <div className="text-sm font-semibold text-white">
                        {draft.portal === "news" ? "News article" : "Blog post"}
                      </div>
                      <div className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        {draft.portal === "news"
                          ? "Exam buzz · dates · results · papers"
                          : "Toppers · tips · Mind & Attitude · revision"}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-xs">
                        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Section
                        </span>
                        <select
                          value={draft.section}
                          onChange={(e) => {
                            const section = e.target.value as SectionId | "";
                            setDraft((prev) => ({
                              ...prev,
                              section,
                              ...(prev.portal === "blog" && section === "blast"
                                ? {}
                                : { revisionPlan: "" as RevisionPlanId }),
                              ...(section === "ndates" && prev.portal === "news"
                                ? {
                                    heroImageUrl: "",
                                    inlineImageUrl: "",
                                    heroImageCaption: "",
                                    inlineImageCaption: "",
                                    author: "",
                                    role: "",
                                  }
                                : {}),
                              ...(section === "nbuzz" && prev.portal === "news"
                                ? { examDate: "" }
                                : {}),
                            }));
                          }}
                          className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                        >
                          <option value="">Select section</option>
                          {(draft.portal === "news" ? composerNewsSections : BLOG_SECTIONS).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs">
                        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Exam category
                        </span>
                        <select
                          value={draft.exam}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, exam: e.target.value as ExamId }))
                          }
                          className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                        >
                          {EXAMS.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                              {exam.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {!isKeyDatesDraft && draft.contentFormat === "text" ? (
                        <>
                          <label className="text-xs">
                            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Author name
                            </span>
                            <input
                              value={draft.author}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, author: e.target.value }))
                              }
                              placeholder="Your name"
                              className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                            />
                          </label>

                          <label className="text-xs">
                            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Author role
                            </span>
                            <input
                              value={draft.role}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, role: e.target.value }))
                              }
                              placeholder="e.g. Editorial team"
                              className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                            />
                          </label>
                        </>
                      ) : null}
                      {isBlastDraft ? (
                        <label className="text-xs sm:col-span-2">
                          <span className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                            <span className="text-slate-400">Plan</span>
                            <span className="text-rose-400" aria-hidden>
                              *
                            </span>
                            <span className="text-[11px] font-normal text-slate-500">
                              Which revision window this post targets
                            </span>
                          </span>
                          <select
                            value={draft.revisionPlan}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                revisionPlan: e.target.value as RevisionPlanId,
                              }))
                            }
                            className="w-full max-w-xs rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                          >
                            <option value="">Select plan</option>
                            <option value="180">180 days</option>
                            <option value="60">60 days</option>
                            <option value="3">3 days</option>
                          </select>
                        </label>
                      ) : null}
                      {draft.portal === "news" ? (
                        draft.section === "ndates" ? (
                          <>
                            <label className="text-xs sm:col-span-2">
                              <span className="mb-1 block text-slate-400">End date</span>
                              <input
                                type="date"
                                value={draft.examDate}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, examDate: e.target.value }))
                                }
                                className="w-full max-w-xs rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                              />
                            </label>
                            <label className="text-xs sm:col-span-2">
                              <span className="mb-1 block text-slate-400">
                                Link (official page)
                              </span>
                              <input
                                type="url"
                                value={draft.sourceLink}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, sourceLink: e.target.value }))
                                }
                                placeholder="https://..."
                                className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                              />
                            </label>
                          </>
                        ) : draft.section === "btoppers" ? (
                          draft.contentFormat === "text" ? (
                            <>
                              <label className="text-xs sm:col-span-2">
                                <span className="mb-1 block text-slate-400">
                                  Author name (required)
                                </span>
                                <input
                                  value={draft.author}
                                  onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, author: e.target.value }))
                                  }
                                  placeholder="e.g. Ritu Sharma (AIR 47)"
                                  className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                                />
                              </label>
                              <label className="text-xs sm:col-span-2">
                                <span className="mb-1 block text-slate-400">
                                  Author rank (required)
                                </span>
                                <input
                                  value={draft.role}
                                  onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, role: e.target.value }))
                                  }
                                  placeholder="AIR 47"
                                  className="w-full max-w-xs rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                                />
                              </label>
                              <label className="text-xs sm:col-span-2">
                                <span className="mb-1 block text-slate-400">
                                  Outcome quote (required)
                                </span>
                                <textarea
                                  value={draft.summary}
                                  onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, summary: e.target.value }))
                                  }
                                  placeholder="e.g. 'I failed 5 mocks in a row, but then I realized...'"
                                  rows={2}
                                  className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                                />
                                <span className="mt-1 text-xs text-slate-500">
                                  Who they are + the surprising twist (2 lines max)
                                </span>
                              </label>
                              <label className="text-xs sm:col-span-2">
                                <span className="mb-1 block text-slate-400">
                                  Core strategy (required)
                                </span>
                                <textarea
                                  value={draft.body}
                                  onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, body: e.target.value }))
                                  }
                                  placeholder={
                                    "Structure the body with:\n- Where they started (relatable struggle)\n- The turning point (specific, not vague)\n- Exact strategy (chapter-wise, timetable, resources)\n- What they'd do differently\n- One advice to current students"
                                  }
                                  rows={8}
                                  className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm leading-relaxed text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                                />
                              </label>
                              <label className="text-xs sm:col-span-2">
                                <span className="mb-1 block text-slate-400">Source link</span>
                                <input
                                  type="url"
                                  value={draft.sourceLink}
                                  onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, sourceLink: e.target.value }))
                                  }
                                  placeholder="e.g. Interview/Instagram link (if public)"
                                  className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                                />
                              </label>
                            </>
                          ) : null
                        ) : draft.section === "nbuzz" ? (
                          <label className="text-xs sm:col-span-2">
                            <span className="mb-1 block text-slate-400">
                              Source link (required)
                            </span>
                            <input
                              type="url"
                              value={draft.sourceLink}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, sourceLink: e.target.value }))
                              }
                              placeholder="https://official-site-link"
                              className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                            />
                          </label>
                        ) : (
                          <>
                            <label className="text-xs">
                              <span className="mb-1 block text-slate-400">Exam date</span>
                              <input
                                type="date"
                                value={draft.examDate}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, examDate: e.target.value }))
                                }
                                className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                              />
                            </label>
                            <label className="text-xs">
                              <span className="mb-1 block text-slate-400">
                                Source link (required)
                              </span>
                              <input
                                type="url"
                                value={draft.sourceLink}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, sourceLink: e.target.value }))
                                }
                                placeholder="https://official-site-link"
                                className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                              />
                            </label>
                          </>
                        )
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-600/30 bg-gradient-to-b from-[#1e2a3d]/96 to-[#151f2d] p-5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.28)] sm:p-6">
                    <div className="mb-5 border-b border-slate-600/20 pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Step 2
                          </p>
                          <h3 className="mt-1 text-base font-semibold tracking-tight text-white">
                            Content
                          </h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {composerHtmlLayoutTab ? (
                              <>
                                <strong>HTML only</strong> on this tab. File upload may set headline
                                / summary from the page; edit those on <strong>Write text</strong>{" "}
                                with author, references, keywords, and publish date.
                              </>
                            ) : (
                              <>
                                One post, two categories: headline and summary live on{" "}
                                <strong>Write text</strong> with the article body (also SEO and{" "}
                                &quot;View text&quot; when HTML exists).{" "}
                                <strong>Upload HTML</strong> is markup only. Preview follows the tab
                                you are on.
                              </>
                            )}
                          </p>
                        </div>
                        {!isKeyDatesDraft ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDraft((prev) => ({
                                  ...prev,
                                  contentFormat: "text",
                                }));
                              }}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                draft.contentFormat === "text"
                                  ? "border-sky-500/45 bg-sky-950/35 text-sky-200"
                                  : "border-slate-600/40 bg-[#1a2434] text-slate-300 hover:text-white"
                              }`}
                            >
                              Write text
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraft((prev) => ({
                                  ...prev,
                                  contentFormat: "html",
                                }));
                                setPreviewHtmlPlain(false);
                              }}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                draft.contentFormat === "html"
                                  ? "border-emerald-500/45 bg-emerald-950/35 text-emerald-200"
                                  : "border-slate-600/40 bg-[#1a2434] text-slate-300 hover:text-white"
                              }`}
                            >
                              Upload HTML
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {isKeyDatesDraft ? (
                        <>
                          <label className="block text-xs">
                            <span className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                              <span className="text-slate-400">Title</span>
                              <span className="text-rose-400" aria-hidden>
                                *
                              </span>
                              <span className="text-[11px] font-normal text-slate-500">
                                max 120 characters
                              </span>
                            </span>
                            <input
                              value={draft.title}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, title: e.target.value }))
                              }
                              maxLength={120}
                              placeholder="Clear, specific headline..."
                              className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                              <span className="text-slate-400">Summary</span>
                              <span className="text-rose-400" aria-hidden>
                                *
                              </span>
                              <span className="text-[11px] font-normal text-slate-500">
                                shown next to the link · max 280 characters
                              </span>
                            </span>
                            <textarea
                              value={draft.summary}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, summary: e.target.value }))
                              }
                              rows={3}
                              maxLength={280}
                              placeholder="Short line beside the link (e.g. Karnataka CET)"
                              className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="mb-1 block text-slate-400">Body</span>
                            <textarea
                              value={draft.body}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, body: e.target.value }))
                              }
                              rows={10}
                              placeholder="Optional longer detail (shown on the post page when filled)"
                              className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                            />
                          </label>
                          <p className="text-[11px] leading-5 text-slate-500">
                            End date and link are set above. Summary appears next to the link in
                            lists; body is optional full detail on the post page. Exam category
                            comes from the dropdown - it appears under each row in the feed.
                          </p>
                        </>
                      ) : (
                        <>
                          {draft.contentFormat === "text" ? (
                            <>
                              <label className="block text-xs">
                                <span className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                  <span className="text-slate-400">Headline</span>
                                  <span className="text-rose-400" aria-hidden>
                                    *
                                  </span>
                                  <span className="text-[11px] font-normal text-slate-500">
                                    max 120 characters
                                  </span>
                                </span>
                                <input
                                  value={draft.title}
                                  onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, title: e.target.value }))
                                  }
                                  maxLength={120}
                                  placeholder="Clear, specific headline..."
                                  className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                                />
                              </label>

                              <label className="block text-xs">
                                <span className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                  <span className="text-slate-400">Summary</span>
                                  <span className="text-rose-400" aria-hidden>
                                    *
                                  </span>
                                  <span className="text-[11px] font-normal text-slate-500">
                                    shown on cards · max 280 characters
                                  </span>
                                </span>
                                <textarea
                                  value={draft.summary}
                                  onChange={(e) =>
                                    setDraft((prev) => ({ ...prev, summary: e.target.value }))
                                  }
                                  rows={3}
                                  maxLength={280}
                                  placeholder="2-3 sentences that pull readers in..."
                                  className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                                />
                              </label>
                            </>
                          ) : null}

                          {draft.contentFormat === "text" ? (
                            <label className="block text-xs">
                              <span className="mb-1 block text-slate-400">
                                Body
                                {draft.rawHtml.trim() ? (
                                  <span className="ml-1.5 font-normal text-slate-500">
                                    (plain article; also SEO / &quot;View text&quot; when HTML is
                                    set)
                                  </span>
                                ) : null}
                              </span>
                              <textarea
                                value={draft.body}
                                onChange={(e) =>
                                  setDraft((prev) => ({ ...prev, body: e.target.value }))
                                }
                                rows={10}
                                placeholder={
                                  draft.rawHtml.trim()
                                    ? "Plain text for readers and search — shown when they use View text."
                                    : undefined
                                }
                                className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                              />
                            </label>
                          ) : (
                            <div className="space-y-2">
                              <span className="mb-1 block text-xs text-slate-400">
                                HTML (rich layout only)
                              </span>
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:border-emerald-400/55">
                                Choose or replace .html file
                                <input
                                  type="file"
                                  accept=".html,text/html"
                                  className="hidden"
                                  onChange={(e) => handleHtmlUpload(e.target.files?.[0])}
                                />
                              </label>
                              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3.5 py-2.5 text-xs text-emerald-200">
                                {uploadedHtmlFileName
                                  ? `Loaded: ${uploadedHtmlFileName}`
                                  : draft.rawHtml.trim()
                                    ? "HTML in editor below (paste or upload)."
                                    : "Upload an HTML file or paste markup below."}
                              </div>
                              <textarea
                                value={draft.rawHtml}
                                onChange={(e) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    rawHtml: e.target.value,
                                  }))
                                }
                                rows={14}
                                placeholder="Raw HTML content"
                                className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 font-mono text-xs text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-emerald-500/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/12"
                              />
                              <p className="text-[11px] leading-5 text-slate-500">
                                Upload may set title and summary from{" "}
                                <code className="rounded bg-slate-800/80 px-1">&lt;title&gt;</code>{" "}
                                / meta description — adjust on{" "}
                                <strong className="text-slate-400">Write text</strong>.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>

                  {!isKeyDatesDraft && draft.contentFormat === "text" ? (
                    <section className="rounded-2xl border border-slate-600/30 bg-gradient-to-b from-[#1e2a3d]/96 to-[#151f2d] p-5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.28)] sm:p-6">
                      <div className="mb-5 border-b border-slate-600/20 pb-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          References
                        </p>
                        <h3 className="mt-1 inline-flex items-center gap-2 text-base font-semibold tracking-tight text-white">
                          <Link2 className="h-4 w-4 text-emerald-400/90" />
                          Sources & links
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Optional citations readers can verify.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <input
                          value={referenceLabel}
                          onChange={(e) => setReferenceLabel(e.target.value)}
                          placeholder="Reference label - e.g. NTA official notification"
                          className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                        />
                        <div className="flex gap-2">
                          <input
                            value={referenceUrl}
                            onChange={(e) => setReferenceUrl(e.target.value)}
                            placeholder="URL - https://..."
                            className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                          />
                          <button
                            type="button"
                            onClick={addReference}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-900/35"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                      {references.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {references.map((ref) => (
                            <div
                              key={ref.id}
                              className="flex items-center gap-2 rounded-lg border border-slate-600/25 bg-[#101a2a] px-3 py-2"
                            >
                              <Link2 className="h-3.5 w-3.5 text-slate-400" />
                              <span className="flex-1 truncate text-xs text-slate-300">
                                {ref.label || ref.url || "Reference"}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setReferences((prev) => prev.filter((item) => item.id !== ref.id))
                                }
                                className="text-slate-400 hover:text-rose-300"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {isKeyDatesDraft || draft.contentFormat === "text" ? (
                    <section className="rounded-2xl border border-slate-600/30 bg-gradient-to-b from-[#1e2a3d]/96 to-[#151f2d] p-5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.28)] sm:p-6">
                      <div className="mb-5 border-b border-slate-600/20 pb-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Step 3
                        </p>
                        <h3 className="mt-1 inline-flex items-center gap-2 text-base font-semibold tracking-tight text-white">
                          <Settings className="h-4 w-4 text-slate-400" />
                          Publish settings
                        </h3>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs">
                          <span className="mb-1 block text-slate-400">Publish date</span>
                          <input
                            type="date"
                            value={draft.publishDate}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, publishDate: e.target.value }))
                            }
                            className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                          />
                        </label>
                        <label className="text-xs">
                          <span className="mb-1 block text-slate-400">Featured</span>
                          <select
                            value={draft.featured}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                featured: e.target.value as Draft["featured"],
                              }))
                            }
                            className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                          >
                            <option value="feed">No - feed only</option>
                            <option value="hero">Yes - hero card</option>
                            <option value="sidebar">Yes - sidebar pick</option>
                          </select>
                        </label>
                      </div>
                      <label className="mt-3 block text-xs">
                        <span className="mb-1 block text-slate-400">Keywords (comma separated)</span>
                        <input
                          value={draft.tags}
                          onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))}
                          placeholder="e.g. JEE, revision, time management, anxiety"
                          className="w-full rounded-xl border border-slate-700/50 bg-[#101a2a] px-3.5 py-2.5 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-600 transition focus:border-sky-500/45 focus:outline-none focus:ring-2 focus:ring-sky-500/12"
                        />
                      </label>
                    </section>
                  ) : null}

                  <section className="rounded-2xl border border-emerald-600/25 bg-gradient-to-br from-emerald-900/25 to-[#151f2d]/95 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">Ready to publish?</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                          Double-check the live preview, then ship it.
                        </p>
                        {composerHtmlLayoutTab ? (
                          <p className="mt-2 text-xs leading-relaxed text-amber-200/90">
                            Open <strong className="text-amber-100">Write text</strong> for author,
                            headline, summary, references, keywords, and publish date — same post.
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPostId(null);
                            setDraft(createInitialDraft({ portal: draft.portal }));
                          }}
                          className="rounded-xl border border-slate-600/35 bg-[#1a2434] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-[#223148] hover:text-white"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={publishPost}
                          disabled={!canPublish}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-500 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                        >
                          <Send className="h-4 w-4" /> {editingPostId ? "Save changes" : "Publish"}
                        </button>
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="lg:sticky lg:top-4 lg:self-start">
                  <div className="rounded-2xl border border-slate-600/30 bg-gradient-to-b from-[#1c2738] via-[#182233] to-[#121a28] p-5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-slate-900/35">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-600/20 pb-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Preview
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">Live card</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                          Follows your tab: text layout on Write text, rich layout on Upload HTML.
                        </p>
                      </div>
                      {showComposerHtmlPreview ? (
                        <button
                          type="button"
                          onClick={() => setPreviewHtmlPlain((v) => !v)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-600/60 bg-[#1a2434] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-emerald-500/50 hover:bg-emerald-950/20 hover:text-emerald-100"
                        >
                          {previewHtmlPlain ? (
                            <>
                              <LayoutTemplate className="h-3.5 w-3.5" aria-hidden /> View HTML
                            </>
                          ) : (
                            <>
                              <FileText className="h-3.5 w-3.5" aria-hidden /> View text
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-sky-500/20 bg-sky-950/35 px-2.5 py-0.5 font-medium text-sky-200/95">
                        {getExamLabel(draft.exam)}
                      </span>
                      <span className="rounded-full border border-violet-500/20 bg-violet-950/35 px-2.5 py-0.5 font-medium text-violet-200/95">
                        {draft.section ? getSectionLabel(draft.section) : "No section"}
                      </span>
                      {isBlastDraft && draft.revisionPlan ? (
                        <span className="rounded-full border border-rose-500/45 bg-rose-950/35 px-2 py-0.5 text-rose-200">
                          {revisionPlanDisplayLabel(draft.revisionPlan)}
                        </span>
                      ) : null}
                    </div>
                    {isKeyDatesDraft ? (
                      <div className="mt-2 flex gap-3 rounded-lg border border-slate-600/30 bg-[#1a2434] p-3">
                        <div className="flex min-w-[3.75rem] shrink-0 flex-col rounded-md border border-slate-600/40 bg-[#101a2a] px-2 py-1.5">
                          <span className="text-center text-xs font-semibold leading-none text-sky-400">
                            {draft.examDate ? formatKeyDateEndBadge(draft.examDate) : "-"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-sm font-semibold leading-snug text-slate-100">
                            {draft.title || "Title"}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                            <span className="text-slate-400">
                              {draft.summary.trim() || draft.body.trim() || "Summary beside link"}
                            </span>
                            {draft.sourceLink.trim() ? (
                              <>
                                <span className="text-slate-600"> · </span>
                                <span className="text-slate-500">
                                  {formatLinkHostDisplay(draft.sourceLink)}
                                </span>
                              </>
                            ) : null}
                          </p>
                          {draft.summary.trim() && draft.body.trim() ? (
                            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                              {draft.body}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : showComposerHtmlPreview ? (
                      <div className="mt-2 overflow-hidden rounded-lg border border-emerald-500/25 bg-[#0f1826]">
                        {previewHtmlPlain ? (
                          <HtmlPlainDocumentView
                            source={{
                              title: draft.title,
                              summary: draft.summary,
                              body: draft.body,
                              rawHtml: draft.rawHtml,
                            }}
                            variant="card"
                          />
                        ) : (
                          <HtmlBodyFrame
                            html={draft.rawHtml}
                            title={draft.title || "HTML preview"}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 rounded-lg border border-slate-600/30 bg-gradient-to-br from-[#1e2d42] to-[#161f2e] p-4 shadow-inner shadow-black/20">
                        {draft.section === "btoppers" ? (
                          <>
                            <h3 className="mb-2 text-xl font-semibold leading-tight tracking-tight text-slate-50">
                              {draft.title || "Headline appears here"}
                            </h3>
                            {draft.summary ? (
                              <blockquote className="my-4 border-l-2 border-sky-500/40 pl-5 italic leading-relaxed text-slate-300">
                                &ldquo;{draft.summary}&rdquo;
                              </blockquote>
                            ) : (
                              <p className="my-3 text-sm text-slate-500">
                                Outcome quote appears here.
                              </p>
                            )}
                            {draft.body ? (
                              <div className="prose prose-sm prose-invert mt-6 max-w-none space-y-4 text-sm leading-relaxed text-slate-300">
                                {draft.body
                                  .split("\n")
                                  .filter((line) => line.trim())
                                  .map((line, idx) => (
                                    <p key={idx} className="whitespace-pre-wrap">
                                      {line}
                                    </p>
                                  ))}
                              </div>
                            ) : (
                              <p className="mt-4 text-sm text-slate-500">
                                Core strategy (structured content) appears here.
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <h3 className="text-xl font-semibold leading-tight tracking-tight text-slate-50">
                              {draft.title || "Headline appears here"}
                            </h3>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">
                              {draft.summary || "Summary appears here."}
                            </p>
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
                              {draft.body || "Article body appears here."}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                    {!isKeyDatesDraft && draft.contentFormat === "text" && draft.rawHtml.trim() ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        HTML is saved for this post. Open{" "}
                        <strong className="text-slate-400">Upload HTML</strong> to preview the rich
                        layout.
                      </p>
                    ) : null}
                    {!isKeyDatesDraft && references.length > 0 ? (
                      <div className="mt-3">
                        <p className="mb-1 text-xs font-semibold text-slate-300">References</p>
                        <ul className="space-y-1 text-xs text-emerald-300">
                          {references.map((ref) => (
                            <li key={ref.id} className="truncate">
                              {ref.label || "Source"} {ref.url ? `- ${ref.url}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {!isKeyDatesDraft ? (
                      <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500">
                        <User className="h-3.5 w-3.5" />
                        {draft.author || "Author"}
                        {draft.role ? ` · ${draft.role}` : ""}
                      </p>
                    ) : null}
                    <div className="mt-4 border-t border-slate-600/20 pt-3 text-[11px] leading-relaxed text-slate-500">
                      Preview only. Published posts are stored in local SQLite for localhost
                      testing.
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
  );
}
