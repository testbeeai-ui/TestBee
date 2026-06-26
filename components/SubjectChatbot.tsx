"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ChevronDown, Copy, Check, ChevronUp, Bot } from "lucide-react";
import ProfPiChatTrigger from "@/components/subject-chat/ProfPiChatTrigger";
import ProfPiChatHeader from "@/components/subject-chat/ProfPiChatHeader";
import ProfPiSuggestedChips from "@/components/subject-chat/ProfPiSuggestedChips";
import { SUBJECT_META } from "@/components/subject-chat/profPiChatTheme";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Subject } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import {
  fetchSubjectChatQuota,
  resetSubjectChatRegionalLanguage,
  type SubjectChatQuotaResponse,
} from "@/lib/subscription/subjectChatClient";
import { resolveSubjectChatLanguage } from "@/lib/subscription/subjectChatLimits";
import { getSubjectChatRegionalLabel, isRegionalSubjectChatCode, type SubjectChatRegionalCode } from "@/lib/subscription/subjectChatRegionalLanguage";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

interface Props {
  subject: Subject;
  topic: string;
  subtopic?: string;
  gradeLevel?: number;
  /** Scope chat storage to URL / taxonomy so colliding topic labels stay separate. */
  board?: string;
  unitSlug?: string;
  topicSlug?: string;
  levelSlug?: string;
  sectionSlug?: string;
  unitLabel?: string;
  chapterTitle?: string;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
];

const SUBJECT_CHAT_UPGRADE_COPY =
  "**Starter** and **Pro** unlock **unlimited** lesson chat per day.\n\nGo to **Profile → Change plan** to upgrade.";

const SUBJECT_CHAT_MULTILINGUAL_UPGRADE_COPY =
  "**Pro** unlocks lesson chat in **English** plus **one** regional language (Hindi, Kannada, Tamil, or Telugu).\n\nGo to **Profile → Change plan** to upgrade.";

function buildLanguageLockedCopy(lockedLabel: string): string {
  return `Your lesson-chat language is locked to **${lockedLabel}**. You can switch between **English** and **${lockedLabel}** only.`;
}

const TYPING_PHRASES: Record<string, string[]> = {
  physics: [
    "Applying Newton's laws...",
    "Calculating forces...",
    "Checking the equations...",
    "Tracing the wave...",
  ],
  chemistry: [
    "Balancing the reaction...",
    "Checking the bonds...",
    "Mixing reagents...",
    "Looking up the compound...",
  ],
  math: [
    "Solving step by step...",
    "Working through the proof...",
    "Crunching numbers...",
    "Checking the formula...",
  ],
};

// BotBubble: renders a bot message with collapsible long content + copy button
const COLLAPSE_THRESHOLD = 420; // chars

function BotBubble({ content }: { content: string }) {
  const isLong = content.length > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(!isLong);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="group relative min-w-0 max-w-full w-full">
      <div
        className={`min-w-0 max-w-full rounded-[14px] border border-[#2A3347] bg-[#1C2333] px-3.5 py-3 chat-markdown text-[13px] leading-relaxed ${!expanded ? "overflow-hidden" : "overflow-x-hidden"}`}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#534AB7] to-[#7F77DD]">
            <Bot className="h-3 w-3 text-white" strokeWidth={2} aria-hidden />
          </div>
          <span className="text-xs font-semibold text-[#AFA9EC]">Prof Pi</span>
          <button
            type="button"
            onClick={handleCopy}
            className="ml-auto text-[#5C6480] transition-colors hover:text-[#9BA3B8]"
            title="Copy"
            aria-label="Copy message"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[#1D9E75]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            a: ({ href, children }) => {
              const safe = href && !href.startsWith("javascript:") ? href : "#";
              return (
                <a
                  href={safe}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#AFA9EC] underline"
                >
                  {children}
                </a>
              );
            },
            img: () => null,
          }}
        >
          {expanded ? content : content.slice(0, COLLAPSE_THRESHOLD) + "…"}
        </ReactMarkdown>
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-[#AFA9EC] transition-colors hover:bg-[#1C2333]"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}

function getPresetQuestions(topic: string, subtopic?: string) {
  const context = subtopic || topic;
  return [
    `What is ${context}?`,
    `How does ${context} work?`,
    `Give a real-life example of ${context}`,
    `What are the key formulas in ${topic}?`,
    `What mistakes do students make in ${context}?`,
  ];
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const CHATBOT_POSITION_KEY = "edublast-chatbot-position-v3";
const CHATBOT_POSITION_KEY_LEGACY = "edublast-chatbot-position-v2";
const LAUNCHER_BOUNDS = { width: 72, height: 72, margin: 8 };
const CHATBOT_SIZE_KEY = "edublast-chatbot-size";
const CHATBOT_HIDE_UNTIL_KEY = "edublast-chatbot-hide-until";
const CHATBOT_HISTORY_PREFIX = "edublast-chatbot-history";
const DEFAULT_SIZE = { width: 390, height: 560 };
const MIN_SIZE = { width: 300, height: 400 };
const MAX_SIZE = { width: 600, height: 800 };

type StoredMessage = {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: string;
};

function clampLauncherPosition(x: number, y: number): { x: number; y: number } {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(
    LAUNCHER_BOUNDS.margin,
    window.innerWidth - LAUNCHER_BOUNDS.width - LAUNCHER_BOUNDS.margin
  );
  const maxY = Math.max(
    LAUNCHER_BOUNDS.margin,
    window.innerHeight - LAUNCHER_BOUNDS.height - LAUNCHER_BOUNDS.margin
  );
  return {
    x: Math.min(maxX, Math.max(LAUNCHER_BOUNDS.margin, x)),
    y: Math.min(maxY, Math.max(LAUNCHER_BOUNDS.margin, y)),
  };
}

function defaultLauncherPosition(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  return clampLauncherPosition(
    24,
    window.innerHeight - LAUNCHER_BOUNDS.height - 24
  );
}

function getStoredPosition(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const v3 = localStorage.getItem(CHATBOT_POSITION_KEY);
    if (v3) {
      const { x, y } = JSON.parse(v3) as { x: number; y: number };
      if (typeof x === "number" && typeof y === "number") {
        return clampLauncherPosition(x, y);
      }
    }
    const legacy = localStorage.getItem(CHATBOT_POSITION_KEY_LEGACY);
    if (legacy) {
      const { x, y } = JSON.parse(legacy) as { x: number; y: number };
      if (typeof x === "number" && typeof y === "number") {
        return clampLauncherPosition(
          x,
          window.innerHeight - y - LAUNCHER_BOUNDS.height
        );
      }
    }
  } catch {}
  return null;
}

function getStoredSize(): { width: number; height: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(CHATBOT_SIZE_KEY);
    if (!s) return null;
    const { width, height } = JSON.parse(s) as { width: number; height: number };
    if (typeof width === "number" && typeof height === "number") return { width, height };
  } catch {}
  return null;
}

function getStoredHideUntil(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHATBOT_HIDE_UNTIL_KEY);
    if (!raw) return null;
    const value = Number(raw);
    if (Number.isFinite(value) && value > Date.now()) return value;
  } catch {}
  return null;
}

function normalizeKeyPart(value: string | number | undefined): string {
  if (value == null) return "na";
  return encodeURIComponent(String(value).trim().toLowerCase());
}

function buildChatHistoryKey(params: {
  subject: Subject;
  topic: string;
  subtopic?: string;
  gradeLevel?: number;
  board?: string;
  unitSlug?: string;
  topicSlug?: string;
  levelSlug?: string;
  sectionSlug?: string;
  unitLabel?: string;
  chapterTitle?: string;
}): string {
  const parts = [
    CHATBOT_HISTORY_PREFIX,
    normalizeKeyPart(params.subject),
    normalizeKeyPart(params.gradeLevel ?? 11),
    normalizeKeyPart(params.topic),
    normalizeKeyPart(params.subtopic ?? ""),
  ];
  const push = (v: string | undefined) => {
    if (v == null) return;
    const t = String(v).trim();
    if (!t) return;
    parts.push(normalizeKeyPart(t));
  };
  push(params.board);
  push(params.unitSlug);
  push(params.topicSlug);
  push(params.levelSlug);
  push(params.sectionSlug);
  push(params.unitLabel);
  push(params.chapterTitle);
  return parts.join(":");
}

export default function SubjectChatbot({
  subject,
  topic,
  subtopic,
  gradeLevel,
  board,
  unitSlug,
  topicSlug,
  levelSlug,
  sectionSlug,
  unitLabel,
  chapterTitle,
}: Props) {
  const { session } = useAuth();
  const isAppAdmin = useIsAppAdmin();
  const [chatQuota, setChatQuota] = useState<SubjectChatQuotaResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState("en");
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [pendingRegionalCode, setPendingRegionalCode] = useState<SubjectChatRegionalCode | null>(null);
  const [langConfirmOpen, setLangConfirmOpen] = useState(false);
  const [resettingRegionalLanguage, setResettingRegionalLanguage] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const [chatSize, setChatSize] = useState(DEFAULT_SIZE);
  const [isResizing, setIsResizing] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showHideMenu, setShowHideMenu] = useState(false);
  const [hideUntil, setHideUntil] = useState<number | null>(null);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [chipsResetKey, setChipsResetKey] = useState(0);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPos: { x: number; y: number };
    grabOffsetX: number;
    grabOffsetY: number;
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    startSize: { width: number; height: number };
  } | null>(null);
  const justDraggedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const positionRef = useRef(position);
  positionRef.current = position;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingPhrases = TYPING_PHRASES[subject] ?? TYPING_PHRASES.physics;
  const [typingPhrase] = useState(
    () => typingPhrases[Math.floor(Math.random() * typingPhrases.length)]
  );
  const meta = SUBJECT_META[subject] ?? SUBJECT_META.physics;
  const presets = getPresetQuestions(topic, subtopic);
  const refreshChatQuota = useCallback(async () => {
    const q = await fetchSubjectChatQuota(session?.access_token);
    setChatQuota(q);
    return q;
  }, [session?.access_token]);

  useEffect(() => {
    if (!isOpen) return;
    void refreshChatQuota();
  }, [isOpen, refreshChatQuota]);

  const hasMultilingual = chatQuota?.multilingual ?? false;
  const regionalLanguage = chatQuota?.regionalLanguage ?? null;
  const needsRegionalLanguageSelection = chatQuota?.needsRegionalLanguageSelection ?? false;

  useEffect(() => {
    if (!isOpen || chatQuota == null) return;
    if (!hasMultilingual && language !== "en") {
      setLanguage("en");
    }
  }, [isOpen, chatQuota, hasMultilingual, language]);

  useEffect(() => {
    if (!regionalLanguage) return;
    if (language !== "en" && language !== regionalLanguage) {
      setLanguage("en");
    }
  }, [regionalLanguage, language]);

  const handleRegionalLanguageSaved = useCallback((patch: Partial<SubjectChatQuotaResponse>) => {
    setChatQuota((prev) => (prev ? { ...prev, ...patch } : prev));
    if (patch.regionalLanguage) {
      setLanguage(patch.regionalLanguage);
    }
    setPendingRegionalCode(null);
    setLangConfirmOpen(false);
    setShowLangMenu(false);
  }, []);

  const handleRegionalLanguageError = useCallback((error: string) => {
    const errMsg: Message = {
      id: crypto.randomUUID(),
      role: "bot",
      content: error,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, errMsg]);
    setPendingRegionalCode(null);
  }, []);

  const handleLanguageSelect = useCallback(
    (code: string) => {
      if (code === "en") {
        setLanguage("en");
        setShowLangMenu(false);
        return;
      }

      if (!hasMultilingual) {
        setShowLangMenu(false);
        const upgradeMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          content: SUBJECT_CHAT_MULTILINGUAL_UPGRADE_COPY,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, upgradeMsg]);
        return;
      }

      if (needsRegionalLanguageSelection) {
        if (!isRegionalSubjectChatCode(code)) return;
        setPendingRegionalCode(code);
        setLangConfirmOpen(true);
        setShowLangMenu(true);
        return;
      }

      if (regionalLanguage && code !== regionalLanguage) {
        setShowLangMenu(false);
        const lockedMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          content: buildLanguageLockedCopy(getSubjectChatRegionalLabel(regionalLanguage)),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, lockedMsg]);
        return;
      }

      if (regionalLanguage && code === regionalLanguage) {
        setLanguage(regionalLanguage);
        setShowLangMenu(false);
      }
    },
    [hasMultilingual, needsRegionalLanguageSelection, regionalLanguage]
  );

  const handleLangConfirmCancel = useCallback(() => {
    setLangConfirmOpen(false);
    setPendingRegionalCode(null);
    setShowLangMenu(true);
  }, []);

  const toggleLangMenu = useCallback(() => {
    setShowLangMenu((open) => {
      if (open) {
        setLangConfirmOpen(false);
        setPendingRegionalCode(null);
        return false;
      }
      return true;
    });
  }, []);

  const handleAdminResetRegionalLanguage = useCallback(async () => {
    if (!isAppAdmin || !session?.access_token || resettingRegionalLanguage) return;
    setResettingRegionalLanguage(true);
    try {
      const result = await resetSubjectChatRegionalLanguage(session.access_token);
      if (!result.ok) {
        handleRegionalLanguageError(result.error);
        return;
      }
      setLanguage("en");
      setShowLangMenu(false);
      setLangConfirmOpen(false);
      setPendingRegionalCode(null);
      setChatQuota((prev) =>
        prev
          ? {
              ...prev,
              regionalLanguage: result.regionalLanguage,
              needsRegionalLanguageSelection: result.needsRegionalLanguageSelection,
              multilingual: result.multilingual,
            }
          : prev
      );
      void refreshChatQuota();
    } finally {
      setResettingRegionalLanguage(false);
    }
  }, [
    handleRegionalLanguageError,
    isAppAdmin,
    refreshChatQuota,
    resettingRegionalLanguage,
    session?.access_token,
  ]);

  const chatHistoryKey = buildChatHistoryKey({
    subject,
    topic,
    subtopic,
    gradeLevel,
    board,
    unitSlug,
    topicSlug,
    levelSlug,
    sectionSlug,
    unitLabel,
    chapterTitle,
  });

  // Apply stored position/size after mount to avoid hydration mismatch (localStorage only on client)
  useEffect(() => {
    const stored = getStoredPosition();
    setPosition(stored ?? defaultLauncherPosition());
    const storedSize = getStoredSize();
    if (storedSize) setChatSize(storedSize);
    const storedHideUntil = getStoredHideUntil();
    if (storedHideUntil) setHideUntil(storedHideUntil);
  }, []);

  // Load context-specific chat history (subject + topic + subtopic + grade).
  useEffect(() => {
    setHistoryHydrated(false);
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(chatHistoryKey);
      if (!raw) {
        setMessages([]);
        setHasGreeted(false);
        setHistoryHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as StoredMessage[];
      if (!Array.isArray(parsed)) {
        setMessages([]);
        setHasGreeted(false);
        setHistoryHydrated(true);
        return;
      }
      const restored = parsed
        .map((m): Message | null => {
          if (!m || (m.role !== "user" && m.role !== "bot") || typeof m.content !== "string")
            return null;
          return {
            id: typeof m.id === "string" && m.id ? m.id : crypto.randomUUID(),
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp || Date.now()),
          };
        })
        .filter((m): m is Message => m !== null);
      setMessages(restored);
      setHasGreeted(restored.length > 0);
      setHistoryHydrated(true);
    } catch {
      setMessages([]);
      setHasGreeted(false);
      setHistoryHydrated(true);
    }
  }, [chatHistoryKey]);

  // Persist context-specific chat history.
  useEffect(() => {
    if (!historyHydrated) return;
    if (typeof window === "undefined") return;
    try {
      const toStore: StoredMessage[] = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }));
      localStorage.setItem(chatHistoryKey, JSON.stringify(toStore));
    } catch {}
  }, [messages, chatHistoryKey, historyHydrated]);

  useEffect(() => {
    if (!hideUntil) return;
    const ms = hideUntil - Date.now();
    if (ms <= 0) {
      setHideUntil(null);
      try {
        localStorage.removeItem(CHATBOT_HIDE_UNTIL_KEY);
      } catch {}
      return;
    }
    const timer = window.setTimeout(() => {
      setHideUntil(null);
      try {
        localStorage.removeItem(CHATBOT_HIDE_UNTIL_KEY);
      } catch {}
    }, ms + 50);
    return () => window.clearTimeout(timer);
  }, [hideUntil]);

  useEffect(() => {
    if (!showHideMenu) return;
    const onGlobalPointerDown = () => setShowHideMenu(false);
    window.addEventListener("pointerdown", onGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", onGlobalPointerDown);
  }, [showHideMenu]);

  // Auto-scroll to latest message — only when user is already near the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBtn(distFromBottom > 150);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Welcome message when first opened
  useEffect(() => {
    if (isOpen && !hasGreeted) {
      setHasGreeted(true);
      const greeting: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        content: `Hi! I'm your **${meta.label}** ${meta.emoji}\n\nI'm here to help you master **${topic}**. Ask me anything — I can explain concepts, solve numerical problems, and give you memory tricks for exams!\n\nWhat would you like to know? 🚀`,
        timestamp: new Date(),
      };
      setTimeout(() => setMessages([greeting]), 300);
    }
  }, [isOpen, hasGreeted, meta.label, meta.emoji, topic]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      if (!session?.access_token) {
        const signInMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          content: "Please **sign in** to use Subject Chat and save your conversation.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, signInMsg]);
        return;
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        };

        const resolvedLanguage = resolveSubjectChatLanguage(language, {
          multilingual: chatQuota?.multilingual ?? false,
          regionalLanguage: chatQuota?.regionalLanguage ?? null,
        });

        const body: Record<string, unknown> = {
          message: trimmed,
          subject,
          topic,
          subtopic,
          language: resolvedLanguage,
          gradeLevel: gradeLevel ?? 11,
        };
        if (board) body.board = board;
        if (unitSlug) body.unitSlug = unitSlug;
        if (topicSlug) body.topicSlug = topicSlug;
        if (levelSlug) body.levelSlug = levelSlug;
        if (sectionSlug) body.sectionSlug = sectionSlug;
        if (unitLabel) body.unitLabel = unitLabel;
        if (chapterTitle) body.chapterTitle = chapterTitle;

        const res = await fetch("/api/subject-chat", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (res.status === 429 || data.code === "SUBJECT_CHAT_DAILY_LIMIT") {
          setChatQuota((prev) =>
            prev
              ? {
                  ...prev,
                  canSend: false,
                  remaining: 0,
                  usedToday: data.usedToday ?? prev.usedToday,
                }
              : prev
          );
        } else if (data.quota) {
          setChatQuota((prev) =>
            prev
              ? {
                  ...prev,
                  usedToday: data.quota.usedToday,
                  remaining: data.quota.remaining,
                  canSend: data.quota.canSend,
                }
              : prev
          );
        } else if (res.ok) {
          void refreshChatQuota();
        }

        let botContent =
          data.reply || data.error || "Sorry, I could not generate a response.";
        if (res.status === 401 || data.code === "SUBJECT_CHAT_AUTH_REQUIRED") {
          botContent = "Please **sign in** to continue chatting.";
        } else if (res.status === 429 || data.code === "SUBJECT_CHAT_DAILY_LIMIT") {
          botContent = SUBJECT_CHAT_UPGRADE_COPY;
        }

        const botMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          content: botContent,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch {
        const errMsg: Message = {
          id: crypto.randomUUID(),
          role: "bot",
          content: "Connection issue. Please check your internet and try again. 🔌",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      subject,
      topic,
      subtopic,
      language,
      chatQuota,
      gradeLevel,
      session?.access_token,
      board,
      unitSlug,
      topicSlug,
      levelSlug,
      sectionSlug,
      unitLabel,
      chapterTitle,
      refreshChatQuota,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const selectedLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...positionRef.current },
      grabOffsetX: e.clientX - rect.left,
      grabOffsetY: e.clientY - rect.top,
    };
    isDraggingRef.current = false;

    const onWindowMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (!isDraggingRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDraggingRef.current = true;
      }
      if (!isDraggingRef.current) return;
      const next = clampLauncherPosition(
        ev.clientX - dragRef.current.grabOffsetX,
        ev.clientY - dragRef.current.grabOffsetY
      );
      positionRef.current = next;
      setPosition(next);
    };

    const onWindowUp = () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      window.removeEventListener("pointercancel", onWindowUp);
      if (!dragRef.current) return;
      if (isDraggingRef.current) {
        justDraggedRef.current = true;
        try {
          localStorage.setItem(CHATBOT_POSITION_KEY, JSON.stringify(positionRef.current));
        } catch {}
      }
      dragRef.current = null;
      isDraggingRef.current = false;
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    window.addEventListener("pointercancel", onWindowUp);
  }, []);

  const handleTriggerClick = useCallback(() => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setIsOpen(true);
  }, []);

  const hideForMinutes = useCallback((minutes: number) => {
    const until = Date.now() + minutes * 60 * 1000;
    setHideUntil(until);
    setShowHideMenu(false);
    setIsOpen(false);
    try {
      localStorage.setItem(CHATBOT_HIDE_UNTIL_KEY, String(until));
    } catch {}
  }, []);

  const buildWelcomeMessage = useCallback((): Message => {
    return {
      id: crypto.randomUUID(),
      role: "bot",
      content: `Hi! I'm your **${meta.label}** ${meta.emoji}\n\nI'm here to help you master **${topic}**. Ask me anything — I can explain concepts, solve numerical problems, and give you memory tricks for exams!\n\nWhat would you like to know? 🚀`,
      timestamp: new Date(),
    };
  }, [meta.label, meta.emoji, topic]);

  const handleResetChat = useCallback(() => {
    try {
      localStorage.removeItem(chatHistoryKey);
    } catch {}
    setChipsResetKey((k) => k + 1);
    setMessages([buildWelcomeMessage()]);
  }, [chatHistoryKey, buildWelcomeMessage]);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = { startX: e.clientX, startY: e.clientY, startSize: { ...chatSize } };
      setIsResizing(true);
    },
    [chatSize]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current || !isResizing) return;
      // Chat is anchored bottom-right, resize handle is top-left corner
      // Dragging left = increase width, dragging up = increase height
      const dx = resizeRef.current.startX - e.clientX;
      const dy = resizeRef.current.startY - e.clientY;
      setChatSize({
        width: Math.max(
          MIN_SIZE.width,
          Math.min(MAX_SIZE.width, resizeRef.current.startSize.width + dx)
        ),
        height: Math.max(
          MIN_SIZE.height,
          Math.min(MAX_SIZE.height, resizeRef.current.startSize.height + dy)
        ),
      });
    },
    [isResizing]
  );

  const handleResizePointerUp = useCallback(() => {
    if (resizeRef.current && isResizing) {
      try {
        localStorage.setItem(CHATBOT_SIZE_KEY, JSON.stringify(chatSize));
      } catch {}
    }
    resizeRef.current = null;
    setIsResizing(false);
  }, [isResizing, chatSize]);

  return (
    <>
      <AnimatePresence>
        {!isOpen && !hideUntil && (
          <ProfPiChatTrigger
            position={position}
            showHideMenu={showHideMenu}
            onHideForMinutes={hideForMinutes}
            onTriggerClick={handleTriggerClick}
            onPointerDown={handlePointerDown}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowHideMenu(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="subject-chat-panel fixed bottom-6 left-6 z-50 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#2A3347] bg-[#161B25]"
            style={{
              width: `min(${chatSize.width}px, calc(100vw - 24px))`,
              height: `min(${chatSize.height}px, calc(100vh - 80px))`,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerUp}
              className="absolute top-0 left-0 z-[60] flex h-8 w-8 cursor-nw-resize items-center justify-center group/resize"
              style={{ touchAction: "none" }}
              title="Drag to resize"
            >
              <div className="grid grid-cols-3 gap-[3px] opacity-40 transition-opacity group-hover/resize:opacity-80">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-[3px] w-[3px] rounded-full bg-white/60" />
                ))}
              </div>
            </div>

            <ProfPiChatHeader
              subject={subject}
              topic={topic}
              subtopic={subtopic}
              chapterTitle={chapterTitle}
              gradeLevel={gradeLevel}
              selectedLangLabel={selectedLang.label}
              language={language}
              showLangMenu={showLangMenu}
              langConfirmOpen={langConfirmOpen}
              pendingRegionalCode={pendingRegionalCode}
              hasMultilingual={hasMultilingual}
              regionalLanguage={regionalLanguage}
              isAppAdmin={isAppAdmin}
              resettingRegionalLanguage={resettingRegionalLanguage}
              accessToken={session?.access_token}
              onToggleLangMenu={toggleLangMenu}
              onLanguageSelect={handleLanguageSelect}
              onLangConfirmCancel={handleLangConfirmCancel}
              onRegionalLanguageSaved={handleRegionalLanguageSaved}
              onRegionalLanguageError={handleRegionalLanguageError}
              onAdminResetRegionalLanguage={handleAdminResetRegionalLanguage}
              onResetChat={handleResetChat}
              onClose={() => setIsOpen(false)}
            />

            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#161B25]">
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="h-full min-h-0 min-w-0 space-y-2.5 overflow-y-auto overflow-x-hidden overscroll-contain px-3.5 py-3.5 [scrollbar-color:#334060_transparent] [scrollbar-width:thin]"
                onClick={() => setShowLangMenu(false)}
              >
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={`flex min-w-0 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`min-w-0 flex flex-col gap-1 group/msg ${msg.role === "user" ? "max-w-[88%] items-end" : "max-w-full w-full items-start"}`}
                      >
                        {msg.role === "user" ? (
                          <div className="whitespace-pre-wrap rounded-[14px] border border-[#1D9E75]/40 bg-[#0A2A20] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#9FE1CB]">
                            {msg.content}
                          </div>
                        ) : (
                          <BotBubble content={msg.content} />
                        )}
                        <span className="px-1 text-[10px] text-[#5C6480] opacity-0 transition-opacity group-hover/msg:opacity-100">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && (
                    <motion.div
                      key="typing"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start"
                    >
                      <div className="flex items-center gap-2 rounded-[14px] border border-[#2A3347] bg-[#1C2333] px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {[0, 0.15, 0.3].map((delay, i) => (
                            <motion.div
                              key={i}
                              className="h-2 w-2 rounded-full bg-[#7F77DD]"
                              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                              transition={{ repeat: Infinity, duration: 0.8, delay }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] italic text-[#5C6480]">{typingPhrase}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              <AnimatePresence>
                {showScrollBtn && (
                  <motion.button
                    key="scroll-btn"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[#2A3347] bg-[#1C2333] px-3 py-1.5 text-[11px] font-semibold text-[#9BA3B8] shadow-md transition-colors hover:bg-[#222A3A]"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    Scroll to latest
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {messages.length <= 1 && (
              <ProfPiSuggestedChips
                presets={presets}
                subject={subject}
                isLoading={isLoading}
                resetKey={chipsResetKey}
                onSelect={sendMessage}
              />
            )}

            <div className="flex shrink-0 items-center gap-2 border-t border-[#2A3347] bg-[#161B25] px-3.5 py-2.5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !session?.access_token ? "Sign in to chat..." : "Ask Prof Pi anything…"
                }
                rows={1}
                disabled={isLoading}
                className="min-h-[36px] max-h-24 flex-1 resize-none rounded-[20px] border border-[#2A3347] bg-[#1C2333] px-3.5 py-2 text-[13px] leading-snug text-[#E8EAF0] outline-none placeholder:text-[#5C6480] focus:border-[#7F77DD] focus:shadow-[0_0_0_2px_rgba(127,119,221,0.15)] overflow-y-auto"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 96) + "px";
                }}
              />
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                  input.trim() && !isLoading
                    ? "bg-gradient-to-br from-[#534AB7] to-[#7F77DD] text-white shadow-md"
                    : "bg-[#1C2333] text-[#5C6480]"
                }`}
              >
                <Send className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
