"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, ChevronDown, Globe, Check, Lock, RotateCcw, X } from "lucide-react";
import type { Subject } from "@/types";
import type { SubjectChatQuotaResponse } from "@/lib/subscription/subjectChatClient";
import type { SubjectChatRegionalCode } from "@/lib/subscription/subjectChatRegionalLanguage";
import SubjectChatRegionalLanguageDropdownConfirm from "@/components/subject-chat/SubjectChatRegionalLanguageDropdownConfirm";
import ProfPiBrandName from "@/components/subject-chat/ProfPiBrandName";
import {
  PROF_PI_CHAT,
  SUBJECT_BREADCRUMB_LABEL,
  SUBJECT_META,
} from "@/components/subject-chat/profPiChatTheme";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
];

interface ProfPiChatHeaderProps {
  subject: Subject;
  /** Kept for API compat; not shown in header */
  topic?: string;
  subtopic?: string;
  chapterTitle?: string;
  gradeLevel?: number;
  selectedLangLabel: string;
  language: string;
  showLangMenu: boolean;
  langConfirmOpen: boolean;
  pendingRegionalCode: SubjectChatRegionalCode | null;
  hasMultilingual: boolean;
  regionalLanguage: SubjectChatRegionalCode | null;
  isAppAdmin: boolean;
  resettingRegionalLanguage: boolean;
  accessToken?: string;
  onToggleLangMenu: () => void;
  onLanguageSelect: (code: string) => void;
  onLangConfirmCancel: () => void;
  onRegionalLanguageSaved: (patch: Partial<SubjectChatQuotaResponse>) => void;
  onRegionalLanguageError: (error: string) => void;
  onAdminResetRegionalLanguage: () => void;
  onResetChat: () => void;
  onClose: () => void;
}

function ContextPill({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[12px] font-semibold leading-none text-white ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

export default function ProfPiChatHeader({
  subject,
  chapterTitle,
  gradeLevel,
  selectedLangLabel,
  language,
  showLangMenu,
  langConfirmOpen,
  pendingRegionalCode,
  hasMultilingual,
  regionalLanguage,
  isAppAdmin,
  resettingRegionalLanguage,
  accessToken,
  onToggleLangMenu,
  onLanguageSelect,
  onLangConfirmCancel,
  onRegionalLanguageSaved,
  onRegionalLanguageError,
  onAdminResetRegionalLanguage,
  onResetChat,
  onClose,
}: ProfPiChatHeaderProps) {
  const meta = SUBJECT_META[subject] ?? SUBJECT_META.physics;
  const subjectLabel = SUBJECT_BREADCRUMB_LABEL[subject];

  return (
    <div
      className="shrink-0 flex flex-col"
      style={{ background: PROF_PI_CHAT.headerGradient }}
    >
      {/* Row 1: icon + title beside it | actions right */}
      <div className="flex items-center gap-2.5 pl-8 pr-4 pt-3 pb-2">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-white/25 bg-white/15">
          <Bot className="h-5 w-5 text-white" strokeWidth={1.75} aria-hidden />
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <ProfPiBrandName piTone="white" />
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#1D9E75] animate-pulse"
              title="Online"
              aria-label="Online"
            />
          </span>
          <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[12px] font-medium leading-none text-white">
            {meta.label}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isAppAdmin && (
            <button
              type="button"
              onClick={() => void onAdminResetRegionalLanguage()}
              disabled={resettingRegionalLanguage}
              title="Reset language lock (admin)"
              aria-label="Reset language lock (admin)"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/22 disabled:opacity-60"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 ${resettingRegionalLanguage ? "animate-spin" : ""}`}
              />
            </button>
          )}
          {isAppAdmin ? (
            <button
              type="button"
              onClick={onResetChat}
              title="Reset chat (admin)"
              aria-label="Reset chat (admin)"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/12 text-white/80 transition-colors hover:bg-white/22"
            >
              <RotateCcw className="h-[15px] w-[15px]" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close chat"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/12 text-white/80 transition-colors hover:bg-white/22"
          >
            <X className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>

      {/* Row 2: subject + class + chapter (single line, chapter truncates) + language */}
      <div className="flex items-center gap-2 border-t border-white/10 pl-4 pr-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <ContextPill className="shrink-0">{subjectLabel}</ContextPill>
          <ContextPill className="shrink-0">Class {gradeLevel ?? 11}</ContextPill>
          {chapterTitle?.trim() ? (
            <ContextPill
              className="min-w-0 max-w-full shrink overflow-hidden"
              title={chapterTitle.trim()}
            >
              <span className="truncate">{chapterTitle.trim()}</span>
            </ContextPill>
          ) : null}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onToggleLangMenu}
            aria-expanded={showLangMenu}
            aria-haspopup="listbox"
            className="flex h-[26px] items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-0 text-[12px] font-semibold leading-none text-white transition-colors hover:bg-white/15"
          >
            <Globe className="h-3 w-3 shrink-0" aria-hidden />
            <span className="max-w-[4.5rem] truncate">{selectedLangLabel}</span>
            <ChevronDown
              className={`h-3 w-3 shrink-0 transition-transform ${showLangMenu ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence>
            {showLangMenu && (
              <motion.div
                role={langConfirmOpen && pendingRegionalCode ? "dialog" : "listbox"}
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                className={`absolute right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-[#2A3347] bg-[#161B25] ${
                  langConfirmOpen && pendingRegionalCode
                    ? "min-w-[17rem] max-w-[min(17rem,calc(100vw-2rem))] shadow-xl"
                    : "min-w-[9.5rem] py-0.5 shadow-lg"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {langConfirmOpen && pendingRegionalCode ? (
                  <SubjectChatRegionalLanguageDropdownConfirm
                    pendingCode={pendingRegionalCode}
                    accentColor={meta.accentColor}
                    lightBg={meta.lightBg}
                    accessToken={accessToken}
                    onCancel={onLangConfirmCancel}
                    onSaved={onRegionalLanguageSaved}
                    onError={onRegionalLanguageError}
                  />
                ) : (
                  LANGUAGES.map((lang) => {
                    const isActive = language === lang.code;
                    const isEnglish = lang.code === "en";
                    const isLockedNonPro = !isEnglish && !hasMultilingual;
                    const isLockedOtherRegional =
                      hasMultilingual &&
                      regionalLanguage != null &&
                      !isEnglish &&
                      lang.code !== regionalLanguage;
                    const isLocked = isLockedNonPro || isLockedOtherRegional;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        aria-disabled={isLocked}
                        onClick={() => onLanguageSelect(lang.code)}
                        className={`flex w-full items-center justify-between gap-2 border-l-[3px] px-3 py-2 text-[13px] text-left transition-colors ${
                          isActive
                            ? "border-l-[#7F77DD] bg-[#171425] font-semibold text-[#AFA9EC]"
                            : isLocked
                              ? "border-l-transparent font-medium text-[#5C6480] hover:bg-[#1C2333]"
                              : "border-l-transparent font-medium text-[#9BA3B8] hover:bg-[#1C2333]"
                        }`}
                      >
                        <span>{lang.label}</span>
                        {isActive ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#7F77DD]" />
                        ) : isLocked ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-[#5C6480]" />
                        ) : null}
                      </button>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
