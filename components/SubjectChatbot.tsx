'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ChevronDown, Globe, Copy, Check, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Subject } from '@/types';
import { useAuth } from '@/hooks/useAuth';

interface Message {
    id: string;
    role: 'user' | 'bot';
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

const SUBJECT_META: Record<Subject, { label: string; emoji: string; gradient: string; accentColor: string; lightBg: string }> = {
    physics: {
        label: 'Physics Bot',
        emoji: '⚡',
        gradient: 'from-blue-600 to-cyan-500',
        accentColor: '#2563eb',
        lightBg: '#eff6ff',
    },
    chemistry: {
        label: 'Chemistry Bot',
        emoji: '🧪',
        gradient: 'from-purple-600 to-violet-500',
        accentColor: '#7c3aed',
        lightBg: '#f5f3ff',
    },
    math: {
        label: 'Math Bot',
        emoji: '📐',
        gradient: 'from-orange-500 to-amber-400',
        accentColor: '#ea580c',
        lightBg: '#fff7ed',
    },
    biology: {
        label: 'Biology Bot',
        emoji: '🧬',
        gradient: 'from-green-600 to-emerald-500',
        accentColor: '#16a34a',
        lightBg: '#f0fdf4',
    },
};

const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'kn', label: 'ಕನ್ನಡ' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'te', label: 'తెలుగు' },
];

const TYPING_PHRASES: Record<string, string[]> = {
    physics: ['Applying Newton\'s laws...', 'Calculating forces...', 'Checking the equations...', 'Tracing the wave...'],
    chemistry: ['Balancing the reaction...', 'Checking the bonds...', 'Mixing reagents...', 'Looking up the compound...'],
    math: ['Solving step by step...', 'Working through the proof...', 'Crunching numbers...', 'Checking the formula...'],
    biology: ['Tracing the pathway...', 'Checking the textbook...', 'Looking up the process...', 'Reading the diagram...'],
};

// BotBubble: renders a bot message with collapsible long content + copy button
const COLLAPSE_THRESHOLD = 420; // chars

function BotBubble({ content, accentColor, gradient }: { content: string; accentColor: string; gradient: string }) {
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
                className={`min-w-0 max-w-full px-3.5 py-2.5 rounded-2xl rounded-bl-md shadow-sm border border-gray-100 bg-white text-gray-800 chat-markdown text-[15px] leading-relaxed ${!expanded ? 'overflow-hidden' : 'overflow-x-hidden'}`}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        // Sanitize links: block javascript: hrefs, always open external links safely
                        a: ({ href, children }) => {
                            const safe = href && !href.startsWith('javascript:') ? href : '#';
                            return <a href={safe} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{children}</a>;
                        },
                        // Disable image rendering — LLM-generated image URLs can be tracking pixels
                        img: () => null,
                    }}
                >
                    {expanded ? content : content.slice(0, COLLAPSE_THRESHOLD) + '…'}
                </ReactMarkdown>
            </div>
            {/* Copy button — shown on hover */}
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded-lg p-1 shadow-sm hover:bg-gray-50"
                title="Copy"
            >
                {copied
                    ? <Check className="w-3 h-3 text-green-500" />
                    : <Copy className="w-3 h-3 text-gray-400" />
                }
            </button>
            {isLong && (
                <button
                    onClick={() => setExpanded(p => !p)}
                    className="mt-1 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full hover:bg-gray-100 transition-colors"
                    style={{ color: accentColor }}
                >
                    {expanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show more</>}
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
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const CHATBOT_POSITION_KEY = 'edublast-chatbot-position';
const CHATBOT_SIZE_KEY = 'edublast-chatbot-size';
const CHATBOT_HIDE_UNTIL_KEY = 'edublast-chatbot-hide-until';
const CHATBOT_HISTORY_PREFIX = 'edublast-chatbot-history';
const DEFAULT_SIZE = { width: 390, height: 560 };
const MIN_SIZE = { width: 300, height: 400 };
const MAX_SIZE = { width: 600, height: 800 };

type StoredMessage = {
    id: string;
    role: 'user' | 'bot';
    content: string;
    timestamp: string;
};

function getStoredPosition(): { x: number; y: number } | null {
    if (typeof window === 'undefined') return null;
    try {
        const s = localStorage.getItem(CHATBOT_POSITION_KEY);
        if (!s) return null;
        const { x, y } = JSON.parse(s) as { x: number; y: number };
        if (typeof x === 'number' && typeof y === 'number') return { x, y };
    } catch {}
    return null;
}

function getStoredSize(): { width: number; height: number } | null {
    if (typeof window === 'undefined') return null;
    try {
        const s = localStorage.getItem(CHATBOT_SIZE_KEY);
        if (!s) return null;
        const { width, height } = JSON.parse(s) as { width: number; height: number };
        if (typeof width === 'number' && typeof height === 'number') return { width, height };
    } catch {}
    return null;
}

function getStoredHideUntil(): number | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(CHATBOT_HIDE_UNTIL_KEY);
        if (!raw) return null;
        const value = Number(raw);
        if (Number.isFinite(value) && value > Date.now()) return value;
    } catch {}
    return null;
}

function normalizeKeyPart(value: string | number | undefined): string {
    if (value == null) return 'na';
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
        normalizeKeyPart(params.subtopic ?? ''),
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
    return parts.join(':');
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
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [language, setLanguage] = useState('en');
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [hasGreeted, setHasGreeted] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
    const [chatSize, setChatSize] = useState(DEFAULT_SIZE);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [showHideMenu, setShowHideMenu] = useState(false);
    const [hideUntil, setHideUntil] = useState<number | null>(null);
    const [historyHydrated, setHistoryHydrated] = useState(false);
    const dragRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
    const resizeRef = useRef<{ startX: number; startY: number; startSize: { width: number; height: number } } | null>(null);
    const justDraggedRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const typingPhrases = TYPING_PHRASES[subject] ?? TYPING_PHRASES.physics;
    const [typingPhrase] = useState(() => typingPhrases[Math.floor(Math.random() * typingPhrases.length)]);
    const meta = SUBJECT_META[subject] ?? SUBJECT_META.physics;
    const presets = getPresetQuestions(topic, subtopic);
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
        if (stored) setPosition(stored);
        const storedSize = getStoredSize();
        if (storedSize) setChatSize(storedSize);
        const storedHideUntil = getStoredHideUntil();
        if (storedHideUntil) setHideUntil(storedHideUntil);
    }, []);

    // Load context-specific chat history (subject + topic + subtopic + grade).
    useEffect(() => {
        setHistoryHydrated(false);
        if (typeof window === 'undefined') return;
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
                    if (!m || (m.role !== 'user' && m.role !== 'bot') || typeof m.content !== 'string') return null;
                    return {
                        id: typeof m.id === 'string' && m.id ? m.id : crypto.randomUUID(),
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
        if (typeof window === 'undefined') return;
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
            try { localStorage.removeItem(CHATBOT_HIDE_UNTIL_KEY); } catch {}
            return;
        }
        const timer = window.setTimeout(() => {
            setHideUntil(null);
            try { localStorage.removeItem(CHATBOT_HIDE_UNTIL_KEY); } catch {}
        }, ms + 50);
        return () => window.clearTimeout(timer);
    }, [hideUntil]);

    useEffect(() => {
        if (!showHideMenu) return;
        const onGlobalPointerDown = () => setShowHideMenu(false);
        window.addEventListener('pointerdown', onGlobalPointerDown);
        return () => window.removeEventListener('pointerdown', onGlobalPointerDown);
    }, [showHideMenu]);

    // Auto-scroll to latest message — only when user is already near the bottom
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        if (isNearBottom || isLoading) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isLoading]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        setShowScrollBtn(distFromBottom > 150);
    }, []);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // Welcome message when first opened
    useEffect(() => {
        if (isOpen && !hasGreeted) {
            setHasGreeted(true);
            const greeting: Message = {
                id: crypto.randomUUID(),
                role: 'bot',
                content: `Hi! I'm your ${meta.label} ${meta.emoji}\n\nI'm here to help you master **${topic}**. Ask me anything — I can explain concepts, solve examples, give memory tricks, or answer in your regional language!\n\nWhat would you like to know? 🚀`,
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

    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) return;

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: trimmed,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Send last 6 messages as history for follow-up context
            const historyToSend = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers.Authorization = `Bearer ${session.access_token}`;
            }

            // Logged-in: server loads thread from Supabase; omit history to reduce payload.
            const body: Record<string, unknown> = {
                message: trimmed,
                subject,
                topic,
                subtopic,
                language,
                gradeLevel: gradeLevel ?? 11,
            };
            if (board) body.board = board;
            if (unitSlug) body.unitSlug = unitSlug;
            if (topicSlug) body.topicSlug = topicSlug;
            if (levelSlug) body.levelSlug = levelSlug;
            if (sectionSlug) body.sectionSlug = sectionSlug;
            if (unitLabel) body.unitLabel = unitLabel;
            if (chapterTitle) body.chapterTitle = chapterTitle;
            if (!session?.access_token) {
                body.history = historyToSend;
            }

            const res = await fetch('/api/subject-chat', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify(body),
            });

            const data = await res.json();

            const botMsg: Message = {
                id: crypto.randomUUID(),
                role: 'bot',
                content: data.reply || data.error || 'Sorry, I could not generate a response.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch {
            const errMsg: Message = {
                id: crypto.randomUUID(),
                role: 'bot',
                content: 'Connection issue. Please check your internet and try again. 🔌',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsLoading(false);
        }
    }, [
        isLoading,
        subject,
        topic,
        subtopic,
        language,
        gradeLevel,
        session?.access_token,
        messages,
        board,
        unitSlug,
        topicSlug,
        levelSlug,
        sectionSlug,
        unitLabel,
        chapterTitle,
    ]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const selectedLang = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        // Do NOT capture pointer here — otherwise the bubble/button never receive click.
        // We'll capture only once a drag is detected in handlePointerMove.
        dragRef.current = { startX: e.clientX, startY: e.clientY, startPos: { ...position } };
        setIsDragging(false);
    }, [position]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const startedDrag = !isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4);
        if (startedDrag) {
            setIsDragging(true);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
        if (isDragging || startedDrag) {
            setPosition({
                x: Math.max(0, Math.min(window.innerWidth - 80, dragRef.current.startPos.x - dx)),
                y: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startPos.y - dy)),
            });
        }
    }, [isDragging]);

    const handlePointerUp = useCallback(() => {
        if (dragRef.current) {
            if (isDragging) {
                justDraggedRef.current = true;
                try { localStorage.setItem(CHATBOT_POSITION_KEY, JSON.stringify(position)); } catch {}
            }
            dragRef.current = null;
        }
        setIsDragging(false);
    }, [isDragging, position]);

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
        try { localStorage.setItem(CHATBOT_HIDE_UNTIL_KEY, String(until)); } catch {}
    }, []);

    const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        resizeRef.current = { startX: e.clientX, startY: e.clientY, startSize: { ...chatSize } };
        setIsResizing(true);
    }, [chatSize]);

    const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
        if (!resizeRef.current || !isResizing) return;
        // Chat is anchored bottom-right, resize handle is top-left corner
        // Dragging left = increase width, dragging up = increase height
        const dx = resizeRef.current.startX - e.clientX;
        const dy = resizeRef.current.startY - e.clientY;
        setChatSize({
            width: Math.max(MIN_SIZE.width, Math.min(MAX_SIZE.width, resizeRef.current.startSize.width + dx)),
            height: Math.max(MIN_SIZE.height, Math.min(MAX_SIZE.height, resizeRef.current.startSize.height + dy)),
        });
    }, [isResizing]);

    const handleResizePointerUp = useCallback(() => {
        if (resizeRef.current && isResizing) {
            try { localStorage.setItem(CHATBOT_SIZE_KEY, JSON.stringify(chatSize)); } catch {}
        }
        resizeRef.current = null;
        setIsResizing(false);
    }, [isResizing, chatSize]);

    return (
        <>
            {/* Floating trigger button - draggable */}
            <AnimatePresence>
                {!isOpen && !hideUntil && (
                    <div
                        className="fixed z-50 flex flex-col items-end gap-3 pointer-events-auto select-none cursor-grab active:cursor-grabbing"
                        style={{
                            right: position.x,
                            bottom: position.y,
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowHideMenu(true);
                        }}
                    >
                        <AnimatePresence>
                            {showHideMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                    className="bg-white border border-gray-200 shadow-xl rounded-xl p-2 w-44"
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <p className="text-[11px] font-semibold text-gray-500 px-2 pb-1">Hide AI helper</p>
                                    {[2, 5, 10].map((min) => (
                                        <button
                                            key={min}
                                            type="button"
                                            className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg hover:bg-gray-100 text-gray-700"
                                            onClick={() => hideForMinutes(min)}
                                        >
                                            Hide for {min} min
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Tooltip speech bubble */}
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 2, type: 'spring' }}
                            className="bg-white px-4 py-2.5 rounded-2xl rounded-br-sm shadow-xl border border-gray-100/50 flex items-center gap-2 origin-bottom-right cursor-grab active:cursor-grabbing"
                            onClick={handleTriggerClick}
                        >
                            <span className="text-sm font-semibold text-gray-700">Need help? Ask AI!</span>
                            <motion.span animate={{ rotate: [0, 15, -10, 15, 0] }} transition={{ repeat: Infinity, duration: 2, delay: 3 }} className="inline-block origin-bottom-center">👋</motion.span>
                        </motion.div>

                        {/* Interactive Bot Avatar */}
                        <motion.button
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleTriggerClick}
                            className="relative group w-[68px] h-[68px] rounded-full flex items-center justify-center outline-none pointer-events-auto"
                        >
                            {/* Pulse glowing rings */}
                            <motion.div
                                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                                className={`absolute inset-0 rounded-full bg-gradient-to-br ${meta.gradient}`}
                            />
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.1, 0.5] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                                className={`absolute inset-0 rounded-full bg-gradient-to-br ${meta.gradient}`}
                            />

                            {/* Main orb core */}
                            <div
                                className={`relative w-full h-full rounded-full bg-gradient-to-br ${meta.gradient} shadow-2xl flex items-center justify-center overflow-visible border-2 border-white/30`}
                                style={{ boxShadow: `0 8px 32px ${meta.accentColor}77, inset 0 4px 8px rgba(255,255,255,0.4)` }}
                            >
                                {/* Animated SVG inside */}
                                <motion.div
                                    animate={{ y: [-2, 2, -2] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                    className="flex items-center justify-center relative w-full h-full"
                                >
                                    <svg viewBox="0 0 100 100" className="w-[58%] h-[58%] fill-white overflow-visible">
                                        {/* Head */}
                                        <rect x="15" y="30" width="70" height="50" rx="16" fill="white" opacity="0.95" />
                                        {/* Ears/Antenna base */}
                                        <rect x="8" y="45" width="10" height="20" rx="4" fill="white" opacity="0.8" />
                                        <rect x="82" y="45" width="10" height="20" rx="4" fill="white" opacity="0.8" />
                                        {/* Antenna wire & bulb */}
                                        <path d="M50 30 L50 12" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
                                        <motion.circle
                                            cx="50" cy="8" r="6" fill="#fbbf24"
                                            animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.2, 0.9] }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                        />

                                        {/* Screen/Visor */}
                                        <rect x="25" y="42" width="50" height="28" rx="10" fill={meta.accentColor} />

                                        {/* Blinking Eyes */}
                                        <motion.g
                                            animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
                                            transition={{ times: [0, 0.9, 0.95, 1, 1], duration: 4, repeat: Infinity }}
                                            style={{ transformOrigin: "50px 56px" }}
                                        >
                                            <circle cx="38" cy="56" r="6" fill="white" />
                                            <circle cx="62" cy="56" r="6" fill="white" />
                                        </motion.g>
                                    </svg>

                                    {/* Subject Context Badge */}
                                    <div className="absolute -bottom-1 -right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center text-sm shadow-[0_4px_12px_rgba(0,0,0,0.15)] border-2 border-slate-50">
                                        {meta.emoji}
                                    </div>
                                </motion.div>
                            </div>
                        </motion.button>
                    </div>
                )}
            </AnimatePresence>

            {/* Chat window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 60, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 60, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                            className="fixed bottom-6 right-6 z-50 flex min-h-0 min-w-0 flex-col rounded-3xl overflow-hidden shadow-2xl"
                        style={{
                            width: `min(${chatSize.width}px, calc(100vw - 24px))`,
                            height: `min(${chatSize.height}px, calc(100vh - 80px))`,
                            boxShadow: `0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)`,
                        }}
                    >
                        {/* Resize handle — top-left corner, 3×3 dot grip */}
                        <div
                            onPointerDown={handleResizePointerDown}
                            onPointerMove={handleResizePointerMove}
                            onPointerUp={handleResizePointerUp}
                            onPointerCancel={handleResizePointerUp}
                            className="absolute top-0 left-0 w-8 h-8 z-[60] cursor-nw-resize flex items-center justify-center group/resize"
                            style={{ touchAction: 'none' }}
                            title="Drag to resize"
                        >
                            <div className="grid grid-cols-3 gap-[3px] opacity-40 group-hover/resize:opacity-80 transition-opacity">
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <div key={i} className="w-[3px] h-[3px] rounded-full bg-white" />
                                ))}
                            </div>
                        </div>
                        {/* Header */}
                        <div className={`flex items-center justify-between px-4 py-3.5 bg-gradient-to-br ${meta.gradient} text-white shrink-0`}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg backdrop-blur-sm">
                                    {meta.emoji}
                                </div>
                                <div>
                                    <p className="font-bold text-[15px] leading-tight">{meta.label}</p>
                                    <p className="text-[11px] text-white/70 leading-tight">{topic}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Language selector */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowLangMenu(p => !p)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-xs font-semibold"
                                    >
                                        <Globe className="w-3.5 h-3.5 opacity-80" />
                                        <span>{selectedLang.label}</span>
                                        <ChevronDown className="w-3 h-3 ml-0.5" />
                                    </button>
                                    <AnimatePresence>
                                        {showLangMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                                                className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10 min-w-[120px]"
                                            >
                                                {LANGUAGES.map(lang => (
                                                    <button
                                                        key={lang.code}
                                                        onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors ${language === lang.code ? 'font-bold text-gray-900 bg-gray-50' : 'text-gray-700'}`}
                                                    >
                                                        <span>{lang.label}</span>
                                                        {language === lang.code && <span className="text-[12px] text-[#10b981] font-extrabold">✓</span>}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
                                    aria-label="Close chat"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden">
                        <div
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                            className="h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain bg-[#f8f9fc] px-4 py-3 space-y-3"
                            onClick={() => setShowLangMenu(false)}
                        >
                            <AnimatePresence initial={false}>
                                {messages.map(msg => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className={`flex min-w-0 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
                                    >
                                        {msg.role === 'bot' && (
                                            <div
                                                className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 bg-gradient-to-br ${meta.gradient} text-white`}
                                            >
                                                {meta.emoji}
                                            </div>
                                        )}
                                        <div className={`min-w-0 max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1 group/msg`}>
                                            {msg.role === 'user' ? (
                                                <div
                                                    className="px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed text-white rounded-br-md whitespace-pre-wrap"
                                                    style={{ background: `linear-gradient(135deg, ${meta.accentColor}, ${meta.accentColor}cc)` }}
                                                >
                                                    {msg.content}
                                                </div>
                                            ) : (
                                                <BotBubble
                                                    content={msg.content}
                                                    accentColor={meta.accentColor}
                                                    gradient={meta.gradient}
                                                />
                                            )}
                                            <span className="text-[10px] text-gray-400 px-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                                                {formatTime(msg.timestamp)}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}

                                {/* Typing indicator */}
                                {isLoading && (
                                    <motion.div
                                        key="typing"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="flex items-center gap-2"
                                    >
                                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm bg-gradient-to-br ${meta.gradient} text-white`}>
                                            {meta.emoji}
                                        </div>
                                        <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-2">
                                            <div className="flex items-center gap-1.5">
                                                {[0, 0.15, 0.3].map((delay, i) => (
                                                    <motion.div
                                                        key={i}
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: meta.accentColor }}
                                                        animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                                                        transition={{ repeat: Infinity, duration: 0.8, delay }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-[11px] text-gray-400 italic">{typingPhrase}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Scroll-to-bottom button */}
                        <AnimatePresence>
                            {showScrollBtn && (
                                <motion.button
                                    key="scroll-btn"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    onClick={scrollToBottom}
                                    className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-md text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors z-10"
                                >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                    Scroll to latest
                                </motion.button>
                            )}
                        </AnimatePresence>
                        </div>

                        {/* Preset chips */}
                        {messages.length <= 1 && (
                            <div className="bg-[#f8f9fc] px-3 pb-2 flex flex-wrap gap-2 overflow-hidden shrink-0">
                                {presets.map(q => (
                                    <button
                                        key={q}
                                        onClick={() => sendMessage(q)}
                                        className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-blue-300 hover:text-blue-600 text-gray-600 transition-colors shadow-sm"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input bar */}
                        <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-3 flex items-end gap-2">
                            <div className="flex-1 bg-[#f1f5f9] rounded-2xl px-3.5 py-2.5 flex items-end gap-2 min-h-[44px]">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={`Ask ${meta.label}...`}
                                    rows={1}
                                    disabled={isLoading}
                                    className="flex-1 bg-transparent resize-none text-sm text-gray-800 placeholder-gray-400 outline-none leading-relaxed max-h-24 overflow-y-auto"
                                    style={{ minHeight: '20px' }}
                                    onInput={e => {
                                        const el = e.currentTarget;
                                        el.style.height = 'auto';
                                        el.style.height = Math.min(el.scrollHeight, 96) + 'px';
                                    }}
                                />
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.08 }}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || isLoading}
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 ${input.trim() && !isLoading
                                    ? `bg-gradient-to-br ${meta.gradient} text-white shadow-md`
                                    : 'bg-gray-100 text-gray-400'
                                    }`}
                            >
                                <Send className="w-4 h-4" />
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
