"use client";

import {
  useState,
  useEffect,
  useCallback,
  startTransition,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAllPosts } from "@/lib/news-blog/news-blog-db";
import { supabase } from "@/integrations/supabase/client";
import { createInitialDraft, normalizePost, postToDraft } from "../post-draft-utils";
import { readBlogEditorPicks, writeBlogEditorPicks } from "../editor-picks-storage";
import { coerceNewsSectionForRole } from "../constants";
import { isBlogSection, isNewsSection, type NewsBlogListNav } from "../nav-query";
import type {
  BlogSection,
  Draft,
  ExamId,
  NewsSection,
  Portal,
  Post,
  ReferenceLink,
  View,
} from "../types";

export interface NewsBlogState {
  isAdmin: boolean;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  portal: Portal;
  setPortal: Dispatch<SetStateAction<Portal>>;
  newsExamFilter: ExamId;
  setNewsExamFilter: Dispatch<SetStateAction<ExamId>>;
  blogExamFilter: ExamId;
  setBlogExamFilter: Dispatch<SetStateAction<ExamId>>;
  newsSection: NewsSection;
  setNewsSection: Dispatch<SetStateAction<NewsSection>>;
  blogSection: BlogSection;
  setBlogSection: Dispatch<SetStateAction<BlogSection>>;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  posts: Post[];
  setPosts: Dispatch<SetStateAction<Post[]>>;
  loading: boolean;
  references: ReferenceLink[];
  setReferences: Dispatch<SetStateAction<ReferenceLink[]>>;
  referenceLabel: string;
  setReferenceLabel: Dispatch<SetStateAction<string>>;
  referenceUrl: string;
  setReferenceUrl: Dispatch<SetStateAction<string>>;
  uploadedHtmlFileName: string;
  setUploadedHtmlFileName: Dispatch<SetStateAction<string>>;
  openPostId: string | null;
  previewHtmlPlain: boolean;
  setPreviewHtmlPlain: Dispatch<SetStateAction<boolean>>;
  editingPostId: string | null;
  setEditingPostId: Dispatch<SetStateAction<string | null>>;
  editorPickIds: [string | null, string | null, string | null];
  editorPicksPanelOpen: boolean;
  setEditorPicksPanelOpen: Dispatch<SetStateAction<boolean>>;
  slotMenuForPostId: string | null;
  setSlotMenuForPostId: Dispatch<SetStateAction<string | null>>;
  blogPostPage: number;
  setBlogPostPage: Dispatch<SetStateAction<number>>;
  newsPostPage: number;
  setNewsPostPage: Dispatch<SetStateAction<number>>;
  goToPost: (id: string | null) => void;
  startEditPost: (p: Post) => void;
  assignPostToEditorPickSlot: (postId: string, slot: 0 | 1 | 2) => void;
  removeDeletedFromEditorPicks: (deletedId: string) => void;
}

function initialPortal(nav?: Partial<NewsBlogListNav>): Portal {
  return nav?.portal ?? "news";
}

function initialNewsSection(nav?: Partial<NewsBlogListNav>): NewsSection {
  if (nav?.section && isNewsSection(nav.section)) return nav.section;
  return "nbuzz";
}

function initialBlogSection(nav?: Partial<NewsBlogListNav>): BlogSection {
  if (nav?.section && isBlogSection(nav.section)) return nav.section;
  return "btoppers";
}

export function useNewsBlogState(opts?: {
  initialPosts?: Post[];
  initialNav?: Partial<NewsBlogListNav>;
}): NewsBlogState {
  const nav = opts?.initialNav;
  const portal0 = initialPortal(nav);
  const { profile, user } = useAuth();
  const [canManageNewsBlog, setCanManageNewsBlog] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user?.id) {
        if (!cancelled) setCanManageNewsBlog(false);
        return;
      }
      if (profile?.role === "admin") {
        if (!cancelled) setCanManageNewsBlog(true);
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setCanManageNewsBlog(!error && !!data);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.role]);

  const [newsSection, setNewsSection] = useState<NewsSection>(initialNewsSection(nav));
  const [blogSection, setBlogSection] = useState<BlogSection>(initialBlogSection(nav));

  useEffect(() => {
    setNewsSection((cur) => coerceNewsSectionForRole(cur));
  }, [canManageNewsBlog]);

  const isAdmin = canManageNewsBlog;
  const [view, setView] = useState<View>("portal");
  const [portal, setPortal] = useState<Portal>(portal0);
  const [newsExamFilter, setNewsExamFilter] = useState<ExamId>(
    portal0 === "news" ? (nav?.exam ?? "all") : "all"
  );
  const [blogExamFilter, setBlogExamFilter] = useState<ExamId>(
    portal0 === "blog" ? (nav?.exam ?? "all") : "all"
  );
  const [draft, setDraft] = useState<Draft>(() => createInitialDraft());
  const [posts, setPosts] = useState<Post[]>(opts?.initialPosts ?? []);
  const [loading, setLoading] = useState(opts?.initialPosts === undefined);
  const [references, setReferences] = useState<ReferenceLink[]>([]);
  const [referenceLabel, setReferenceLabel] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [uploadedHtmlFileName, setUploadedHtmlFileName] = useState("");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [previewHtmlPlain, setPreviewHtmlPlain] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editorPickIds, setEditorPickIds] = useState<[string | null, string | null, string | null]>(
    [null, null, null]
  );
  const [editorPicksPanelOpen, setEditorPicksPanelOpen] = useState(false);
  const [slotMenuForPostId, setSlotMenuForPostId] = useState<string | null>(null);
  const [blogPostPage, setBlogPostPage] = useState(portal0 === "blog" ? (nav?.page ?? 1) : 1);
  const [newsPostPage, setNewsPostPage] = useState(portal0 === "news" ? (nav?.page ?? 1) : 1);

  const goToPost = useCallback((id: string | null) => {
    setOpenPostId(id);
  }, []);

  useEffect(() => {
    startTransition(() => {
      setPreviewHtmlPlain(false);
    });
  }, [draft.rawHtml, draft.contentFormat]);

  const startEditPost = useCallback(
    (p: Post) => {
      setDraft(postToDraft(p));
      setEditingPostId(p.id);
      setReferences([]);
      setReferenceLabel("");
      setReferenceUrl("");
      setView("upload");
      goToPost(null);
    },
    [goToPost]
  );

  useEffect(() => {
    startTransition(() => {
      setEditorPickIds(readBlogEditorPicks());
    });
  }, []);

  useEffect(() => {
    startTransition(() => {
      setSlotMenuForPostId(null);
    });
  }, [portal]);

  const assignPostToEditorPickSlot = useCallback((postId: string, slot: 0 | 1 | 2) => {
    setEditorPickIds((prev) => {
      const next: [string | null, string | null, string | null] = [
        prev[0] === postId ? null : prev[0],
        prev[1] === postId ? null : prev[1],
        prev[2] === postId ? null : prev[2],
      ];
      next[slot] = postId;
      writeBlogEditorPicks(next);
      return next;
    });
    setSlotMenuForPostId(null);
  }, []);

  const removeDeletedFromEditorPicks = useCallback((deletedId: string) => {
    setEditorPickIds((prev) => {
      const next: [string | null, string | null, string | null] = [
        prev[0] === deletedId ? null : prev[0],
        prev[1] === deletedId ? null : prev[1],
        prev[2] === deletedId ? null : prev[2],
      ];
      writeBlogEditorPicks(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getAllPosts().then((data) => {
      if (cancelled) return;
      setPosts(data.map(normalizePost).filter((p): p is Post => p !== null));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
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
  };
}
