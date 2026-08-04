"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Subject } from "@/types";
import {
  displayClassLabel,
  displaySubjectLabel,
  getChapterWeightagePercent,
} from "@/lib/dive/chapterWeightage";
import { chaptersForSubjectClass, subtopicsForChapter } from "@/lib/dive/curriculumHelpers";
import {
  buildShuffledOrder,
  getNextSuggestBatch,
  resetSuggestBatch,
  type DiveSubtopicCandidate,
  type SuggestBatchState,
} from "@/lib/dive/suggestBatch";
import { weightageTierClass } from "@/lib/dive/subtopicWeightage";
import type { TopicNode } from "@/data/topicTaxonomy";
import type { DiveChapterSession } from "@/lib/dive/diveSessionStorage";
import { cn } from "@/lib/utils";
import styles from "../styles";
import DiveButton from "../ui/DiveButton";

type Props = {
  taxonomy: TopicNode[];
  classLevel: 11 | 12;
  subject: Subject;
  chapterTitle: string;
  onChapterChange: (chapter: string) => void;
  selectedSubtopic: DiveSubtopicCandidate | null;
  onSelectSubtopic: (sub: DiveSubtopicCandidate | null) => void;
  chapterSession: DiveChapterSession | null;
  onChapterSessionChange: (session: DiveChapterSession | null) => void;
  onDiveIn: () => void;
  onBack: () => void;
};

type BrowseMode = "none" | "ai" | "search";

function initFromSession(
  session: DiveChapterSession | null,
  chapterTitle: string
): {
  browseMode: BrowseMode;
  batchState: SuggestBatchState;
  order: number[];
  batchIndices: number[];
  seenBefore: Set<number>;
  searchQuery: string;
} {
  if (session && session.chapterTitle === chapterTitle && chapterTitle) {
    const browseMode: BrowseMode = session.showSearch
      ? "search"
      : session.showSuggestions
        ? "ai"
        : "none";
    return {
      browseMode,
      batchState: session.batchState,
      order: session.order,
      batchIndices: session.batchIndices,
      seenBefore: new Set(session.seenBefore),
      searchQuery: session.searchQuery ?? "",
    };
  }
  return {
    browseMode: "none",
    batchState: resetSuggestBatch(),
    order: [],
    batchIndices: [],
    seenBefore: new Set(),
    searchQuery: "",
  };
}

function matchesSearch(item: DiveSubtopicCandidate, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.name.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q) ||
    item.topicTitle.toLowerCase().includes(q)
  );
}

export default function DiveChapterStep({
  taxonomy,
  classLevel,
  subject,
  chapterTitle,
  onChapterChange,
  selectedSubtopic,
  onSelectSubtopic,
  chapterSession,
  onChapterSessionChange,
  onDiveIn,
  onBack,
}: Props) {
  const chapters = useMemo(
    () => chaptersForSubjectClass(taxonomy, subject, classLevel),
    [taxonomy, subject, classLevel]
  );

  const pool = useMemo(
    () =>
      chapterTitle
        ? subtopicsForChapter(taxonomy, subject, classLevel, chapterTitle)
        : [],
    [taxonomy, subject, classLevel, chapterTitle]
  );

  const chapterWeight = useMemo(
    () =>
      chapterTitle ? getChapterWeightagePercent(subject, classLevel, chapterTitle) : 0,
    [subject, classLevel, chapterTitle]
  );

  const initial = initFromSession(chapterSession, chapterTitle);
  const [loading, setLoading] = useState(false);
  const [browseMode, setBrowseMode] = useState<BrowseMode>(initial.browseMode);
  const [batchState, setBatchState] = useState<SuggestBatchState>(initial.batchState);
  const [order, setOrder] = useState<number[]>(initial.order);
  const [batchIndices, setBatchIndices] = useState<number[]>(initial.batchIndices);
  const [seenBefore, setSeenBefore] = useState<Set<number>>(initial.seenBefore);
  const [searchQuery, setSearchQuery] = useState(initial.searchQuery);
  const [refreshSpin, setRefreshSpin] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const trackedChapter = useRef(chapterTitle);

  const publishSession = useCallback(
    (next: {
      browseMode: BrowseMode;
      batchState: SuggestBatchState;
      order: number[];
      batchIndices: number[];
      seenBefore: Set<number>;
      searchQuery: string;
    }) => {
      if (!chapterTitle) {
        onChapterSessionChange(null);
        return;
      }
      onChapterSessionChange({
        chapterTitle,
        showSuggestions: next.browseMode === "ai",
        showSearch: next.browseMode === "search",
        searchQuery: next.searchQuery,
        batchState: next.batchState,
        order: next.order,
        batchIndices: next.batchIndices,
        seenBefore: Array.from(next.seenBefore),
      });
    },
    [chapterTitle, onChapterSessionChange]
  );

  // Only reset when the chapter value actually changes — not on remount/back.
  useEffect(() => {
    if (trackedChapter.current === chapterTitle) return;
    trackedChapter.current = chapterTitle;

    onSelectSubtopic(null);

    if (chapterSession && chapterSession.chapterTitle === chapterTitle) {
      const mode: BrowseMode = chapterSession.showSearch
        ? "search"
        : chapterSession.showSuggestions
          ? "ai"
          : "none";
      setBrowseMode(mode);
      setBatchState(chapterSession.batchState);
      setOrder(chapterSession.order);
      setBatchIndices(chapterSession.batchIndices);
      setSeenBefore(new Set(chapterSession.seenBefore));
      setSearchQuery(chapterSession.searchQuery ?? "");
      return;
    }

    setBrowseMode("none");
    setBatchState(resetSuggestBatch());
    setBatchIndices([]);
    setSeenBefore(new Set());
    setSearchQuery("");
    onChapterSessionChange(null);
    if (pool.length > 0 && chapterTitle) {
      setOrder(
        buildShuffledOrder(pool.length, `${subject}|${classLevel}|${chapterTitle}`)
      );
    } else {
      setOrder([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only react to chapterTitle identity
  }, [chapterTitle]);

  // Sync local UI when parent restores session after Back (same chapter, remount)
  useEffect(() => {
    if (!chapterSession || chapterSession.chapterTitle !== chapterTitle) return;
    if (trackedChapter.current !== chapterTitle) return;
    const mode: BrowseMode = chapterSession.showSearch
      ? "search"
      : chapterSession.showSuggestions
        ? "ai"
        : "none";
    setBrowseMode(mode);
    setBatchState(chapterSession.batchState);
    setOrder(chapterSession.order);
    setBatchIndices(chapterSession.batchIndices);
    setSeenBefore(new Set(chapterSession.seenBefore));
    setSearchQuery(chapterSession.searchQuery ?? "");
  }, [chapterSession, chapterTitle]);

  useEffect(() => {
    if (browseMode !== "search") return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [browseMode, chapterTitle]);

  const askAi = () => {
    if (!chapterTitle || pool.length === 0) return;
    setLoading(true);
    setBrowseMode("none");
    const freshOrder = buildShuffledOrder(
      pool.length,
      `${subject}|${classLevel}|${chapterTitle}|${Date.now()}`
    );
    setOrder(freshOrder);
    window.setTimeout(() => {
      const result = getNextSuggestBatch(freshOrder, resetSuggestBatch());
      setBatchState(result.state);
      setBatchIndices(result.indices);
      setSeenBefore(result.seenBefore);
      onSelectSubtopic(null);
      setBrowseMode("ai");
      setLoading(false);
      publishSession({
        browseMode: "ai",
        batchState: result.state,
        order: freshOrder,
        batchIndices: result.indices,
        seenBefore: result.seenBefore,
        searchQuery,
      });
    }, 700);
  };

  const openSearch = () => {
    if (!chapterTitle || pool.length === 0) return;
    setLoading(false);
    setBrowseMode("search");
    publishSession({
      browseMode: "search",
      batchState,
      order,
      batchIndices,
      seenBefore,
      searchQuery,
    });
  };

  const refresh = () => {
    setRefreshSpin(true);
    window.setTimeout(() => {
      const result = getNextSuggestBatch(order, batchState);
      setBatchState(result.state);
      setBatchIndices(result.indices);
      setSeenBefore(result.seenBefore);
      onSelectSubtopic(null);
      setRefreshSpin(false);
      publishSession({
        browseMode: "ai",
        batchState: result.state,
        order,
        batchIndices: result.indices,
        seenBefore: result.seenBefore,
        searchQuery,
      });
    }, 400);
  };

  const selectSuggestion = (item: DiveSubtopicCandidate) => {
    onSelectSubtopic(item);
    publishSession({
      browseMode,
      batchState,
      order,
      batchIndices,
      seenBefore,
      searchQuery,
    });
  };

  const selectFromSearch = (item: DiveSubtopicCandidate) => {
    onSelectSubtopic(item);
    setBrowseMode("search");
    publishSession({
      browseMode: "search",
      batchState,
      order,
      batchIndices,
      seenBefore,
      searchQuery,
    });
  };

  const onSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    if (browseMode !== "search") setBrowseMode("search");
    publishSession({
      browseMode: "search",
      batchState,
      order,
      batchIndices,
      seenBefore,
      searchQuery: value,
    });
  };

  const filteredPool = useMemo(
    () => pool.filter((item) => matchesSearch(item, searchQuery)),
    [pool, searchQuery]
  );

  const badge = `— ${displayClassLabel(classLevel)} ${displaySubjectLabel(subject)}`;
  const canBrowse = Boolean(chapterTitle && pool.length > 0);

  const renderSubtopicRow = (
    item: DiveSubtopicCandidate,
    opts?: {
      seen?: boolean;
      keySuffix?: string | number;
      onSelect?: (item: DiveSubtopicCandidate) => void;
    }
  ) => {
    const tier = weightageTierClass(item.relativePct);
    const selected = selectedSubtopic?.id === item.id;
    const wtClass =
      tier === "high"
        ? styles.weightHigh
        : tier === "med"
          ? styles.weightMed
          : styles.weightLow;
    return (
      <button
        key={`${item.id}${opts?.keySuffix != null ? `-${opts.keySuffix}` : ""}`}
        type="button"
        className={`${styles.suggestItem} ${selected ? styles.suggestSelected : ""}`}
        onClick={() => (opts?.onSelect ?? selectSuggestion)(item)}
      >
        <div className={styles.radioDot}>
          <div className={styles.radioInner} />
        </div>
        <div className={styles.suggestText}>
          <div className={styles.suggestTitle}>{item.name}</div>
          <div className={styles.suggestDesc}>{item.description}</div>
          {opts?.seen ? (
            <div className={styles.hintSeen}>Seen before · still worth another dive</div>
          ) : null}
        </div>
        <div className={`${styles.weightage} ${wtClass}`}>
          <div className={styles.num}>{item.relativePct}%</div>
          <div className={styles.wtLabel}>of chapter</div>
        </div>
      </button>
    );
  };

  const diveInBar = (
    <div className={styles.hubFooter}>
      <DiveButton
        type="button"
        variant="outline"
        className={styles.hubFooterBack}
        onClick={onBack}
        aria-label="Change subject"
      >
        <span className={styles.hubNavBackIcon} aria-hidden>
          <i className="ti ti-arrow-left" />
        </span>
        Change Subject
      </DiveButton>
      <DiveButton
        type="button"
        variant="primary"
        className={styles.hubFooterNew}
        disabled={!selectedSubtopic}
        onClick={onDiveIn}
      >
        Dive In
        <i className="ti ti-arrow-right text-[15px]" aria-hidden />
      </DiveButton>
    </div>
  );

  return (
    <section>
      <h1 className={styles.title}>Pick a chapter, then suggest — or search — for sub-topics</h1>
      <p className={styles.subtitle}>
        Ask for 5 high-yield picks on the left, or search this chapter&apos;s full sub-topic list
        on the right when you already know what to study.
      </p>

      <div className={styles.chapterStepGrid}>
        <div className={styles.chapterPanel}>
          <label className={styles.fieldLabel} htmlFor="dive-chapter-select">
            Chapter{" "}
            <span style={{ color: "var(--dive-muted)", textTransform: "none" }}>{badge}</span>
          </label>

          <div className={styles.chapterSelectWrap}>
            <select
              id="dive-chapter-select"
              className={styles.chapterSelect}
              value={chapterTitle}
              onChange={(e) => onChapterChange(e.target.value)}
            >
              <option value="">Select a chapter…</option>
              {chapters.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`${styles.weightBanner} ${chapterTitle ? styles.weightBannerShow : ""}`}
          >
            <div className={styles.cwbNum}>{chapterWeight}%</div>
            <div className={styles.cwbText}>
              This chapter carries <b>{chapterTitle || "—"}</b>&apos;s share of the overall exam
              weightage (JEE/KCET blended, illustrative). Sub-topic weightage below is calculated{" "}
              <b>relative to this chapter</b>.
            </div>
          </div>

          <button
            type="button"
            className={cn(
              "w-full rounded-xl py-3 px-4 font-extrabold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm",
              !canBrowse
                ? "bg-slate-800/40 border border-slate-700/50 text-slate-400 cursor-not-allowed opacity-60"
                : browseMode === "ai"
                  ? "bg-emerald-600 border border-emerald-500 text-white font-extrabold shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/40"
                  : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold shadow-md hover:shadow-emerald-500/20 active:scale-[0.98]"
            )}
            disabled={!canBrowse || loading}
            onClick={askAi}
            aria-pressed={browseMode === "ai"}
          >
            {loading ? (
              <>
                <div className={styles.dotSpin} />
                <span>Prof Pi is analyzing syllabus...</span>
              </>
            ) : !canBrowse ? (
              <>
                <i className="ti ti-lock text-xs" aria-hidden="true" />
                <span>Select a chapter above to unlock AI picks</span>
              </>
            ) : (
              <>
                <span>Suggest high-yield sub-topics</span>
              </>
            )}
          </button>
          {chapterTitle && pool.length === 0 ? (
            <p className={styles.suggestFormula} style={{ marginTop: 12 }}>
              No sub-topics found for this chapter in the syllabus yet.
            </p>
          ) : null}
        </div>

        <aside
          className={`${styles.searchSidePanel} ${
            browseMode === "search" ? styles.searchSidePanelActive : ""
          }`}
          aria-label="Search sub-topics"
        >
          <div className={styles.searchSideHead}>
            <h3>Search sub-topics</h3>
            <p>
              {chapterTitle
                ? `Find any syllabus sub-topic in ${chapterTitle}.`
                : "Select a chapter first, then search its full list."}
            </p>
          </div>

          <div className={styles.searchFieldWrap}>
            <i className={`ti ti-search ${styles.searchFieldIcon}`} aria-hidden />
            <input
              ref={searchInputRef}
              id="dive-subtopic-search"
              type="search"
              className={styles.searchField}
              value={searchQuery}
              disabled={!canBrowse || loading}
              onFocus={() => {
                if (canBrowse && browseMode !== "search") openSearch();
              }}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={
                chapterTitle ? "Type a sub-topic name…" : "Select a chapter to search…"
              }
              autoComplete="off"
              spellCheck={false}
              aria-label={
                chapterTitle
                  ? `Search sub-topics in ${chapterTitle}`
                  : "Search sub-topics (select a chapter first)"
              }
            />
          </div>

          <div className={styles.searchMeta}>
            <span>
              {!canBrowse
                ? "Waiting for a chapter"
                : searchQuery.trim()
                  ? `${filteredPool.length} of ${pool.length} match${
                      filteredPool.length === 1 ? "" : "es"
                    }`
                  : `${pool.length} sub-topic${pool.length === 1 ? "" : "s"} in this chapter`}
            </span>
            {searchQuery.trim() ? (
              <button
                type="button"
                className={styles.searchClearBtn}
                onClick={() => onSearchQueryChange("")}
              >
                Clear
              </button>
            ) : null}
          </div>

          {!canBrowse ? (
            <div className={styles.searchSideEmpty}>
              Pick a chapter on the left to unlock search.
            </div>
          ) : !searchQuery.trim() ? (
            <div className={styles.searchSideEmpty}>
              Type a name above — matching sub-topics will appear here.
            </div>
          ) : filteredPool.length === 0 ? (
            <div className={styles.searchSideEmpty}>
              No matches for <b>&ldquo;{searchQuery.trim()}&rdquo;</b>. Try another spelling, or ask
              AI.
            </div>
          ) : (
            <div className={`${styles.suggestList} ${styles.searchSuggestList}`}>
              {filteredPool.map((item) =>
                renderSubtopicRow(item, { onSelect: selectFromSearch })
              )}
            </div>
          )}
        </aside>
      </div>

      {loading ? (
        <div className={styles.aiLoading}>
          <div className={styles.dotSpin} />
          Finding high-yield sub-topics for this chapter…
        </div>
      ) : null}

      {browseMode === "ai" ? (
        <div className={styles.suggestBlock}>
          <div className={styles.suggestHead}>
            <div>
              <h3>Top 5 high-yield sub-topics</h3>
              <p className={styles.suggestFormula}>
                Weightage shown is each sub-topic&apos;s share of this chapter. Prefer a specific
                one? Use Search on the right.
              </p>
            </div>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={refresh}
              disabled={pool.length === 0}
              style={refreshSpin ? { opacity: 0.7 } : undefined}
            >
              <i className="ti ti-refresh" aria-hidden />
              Refresh (next 5)
            </button>
          </div>

          {batchIndices.length === 0 ? (
            <div className={styles.emptySuggest}>
              You&apos;ve explored every suggested sub-topic in <b>{chapterTitle}</b> — search on
              the right, or pick another chapter.
            </div>
          ) : (
            <div className={styles.suggestList}>
              {batchIndices.map((idx) => {
                const item = pool[idx];
                if (!item) return null;
                return renderSubtopicRow(item, { seen: seenBefore.has(idx), keySuffix: idx });
              })}
            </div>
          )}

          {diveInBar}
        </div>
      ) : null}

      {browseMode === "search" && selectedSubtopic ? (
        <div className={styles.suggestBlock}>{diveInBar}</div>
      ) : null}

      {(browseMode === "none" || (browseMode === "search" && !selectedSubtopic)) && !loading ? (
        <nav className={styles.hubNav} aria-label="Dive navigation">
          <DiveButton
            type="button"
            variant="outline"
            className={styles.hubNavBack}
            onClick={onBack}
            aria-label="Back"
          >
            <span className={styles.hubNavBackIcon} aria-hidden>
              <i className="ti ti-arrow-left" />
            </span>
            Back
          </DiveButton>
        </nav>
      ) : null}
    </section>
  );
}
