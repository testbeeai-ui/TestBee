'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ChevronDown, Mic, Sparkles, Globe } from 'lucide-react';
import type { Subject } from '@/types';

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

export default function SubjectChatbot({ subject, topic, subtopic }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [language, setLanguage] = useState('en');
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [hasGreeted, setHasGreeted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const meta = SUBJECT_META[subject] ?? SUBJECT_META.physics;
    const presets = getPresetQuestions(topic, subtopic);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Welcome message when first opened
    useEffect(() => {
        if (isOpen && !hasGreeted) {
            setHasGreeted(true);
            const greeting: Message = {
                id: `bot-${Date.now()}`,
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
            id: `user-${Date.now()}`,
            role: 'user',
            content: trimmed,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/subject-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: trimmed, subject, topic, subtopic, language }),
            });

            const data = await res.json();

            const botMsg: Message = {
                id: `bot-${Date.now()}`,
                role: 'bot',
                content: data.reply || data.error || 'Sorry, I could not generate a response.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, botMsg]);
        } catch {
            const errMsg: Message = {
                id: `bot-err-${Date.now()}`,
                role: 'bot',
                content: 'Connection issue. Please check your internet and try again. 🔌',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, subject, topic, subtopic, language]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const selectedLang = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

    return (
        <>
            {/* Floating trigger button */}
            <AnimatePresence>
                {!isOpen && (
                    <div className="fixed bottom-28 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
                        {/* Tooltip speech bubble */}
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 2, type: 'spring' }}
                            className="bg-white px-4 py-2.5 rounded-2xl rounded-br-sm shadow-xl border border-gray-100/50 flex items-center gap-2 origin-bottom-right pointer-events-auto cursor-pointer"
                            onClick={() => setIsOpen(true)}
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
                            onClick={() => setIsOpen(true)}
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
                        className="fixed bottom-6 right-6 z-50 flex flex-col rounded-3xl overflow-hidden shadow-2xl"
                        style={{
                            width: 'min(390px, calc(100vw - 24px))',
                            height: 'min(560px, calc(100vh - 80px))',
                            boxShadow: `0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)`,
                        }}
                    >
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
                                    onClick={() => setIsOpen(false)}
                                    className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto bg-[#f8f9fc] px-4 py-3 space-y-3" onClick={() => setShowLangMenu(false)}>
                            <AnimatePresence initial={false}>
                                {messages.map(msg => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
                                    >
                                        {msg.role === 'bot' && (
                                            <div
                                                className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 bg-gradient-to-br ${meta.gradient} text-white`}
                                            >
                                                {meta.emoji}
                                            </div>
                                        )}
                                        <div className={`max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                            <div
                                                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                                    ? 'bg-gradient-to-br text-white rounded-br-md'
                                                    : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                                                    }`}
                                                style={msg.role === 'user' ? { background: `linear-gradient(135deg, ${meta.accentColor}, ${meta.accentColor}cc)` } : {}}
                                            >
                                                {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
                                            </div>
                                            <span className="text-[10px] text-gray-400 px-1">{formatTime(msg.timestamp)}</span>
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
                                        <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-1.5">
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
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Preset chips */}
                        {messages.length <= 1 && (
                            <div className="bg-[#f8f9fc] px-3 pb-2 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] shrink-0">
                                {presets.slice(0, 3).map(q => (
                                    <button
                                        key={q}
                                        onClick={() => sendMessage(q)}
                                        className="whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-blue-300 hover:text-blue-600 text-gray-600 transition-colors shrink-0 shadow-sm"
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
