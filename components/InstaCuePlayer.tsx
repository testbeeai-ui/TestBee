import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/useUserStore';
import { syncAllSavedContent } from '@/lib/savedContentService';
import MathText from '@/components/MathText';
import { SavedRevisionCard } from '@/types';
import { Plus, HelpCircle, Clock, Check, Layers, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    cards: SavedRevisionCard[];
    onClose: () => void;
}

type TabType = 'new' | 'unsure' | 'tomorrow' | 'know_it' | 'all';

function normalizeTrigNotation(raw: string): string {
    let out = raw;
    const trigMap: Record<string, string> = {
        sin: "\\sin",
        cos: "\\cos",
        tan: "\\tan",
        cot: "\\cot",
        sec: "\\sec",
        cosec: "\\csc",
        csc: "\\csc",
    };

    out = out.replace(/\b(sin|cos|tan|cot|sec|cosec|csc)\s*\^\s*-?1\s*x\b/gi, (_m, fn: string) => {
        const key = fn.toLowerCase();
        return `${trigMap[key] ?? `\\${key}`}^{-1}x`;
    });

    out = out.replace(/\bpi\b/gi, "\\pi");
    out = out.replace(/\\?ext\{/g, "\\text{");
    out = out.replace(/\\frac\\pi\{2\}/g, "\\frac{\\pi}{2}");
    return out;
}

function normalizeCardMath(raw: string, wrapInlineMath = false): string {
    let out = raw ?? '';
    // Handle doubly-escaped delimiters from JSON payloads.
    out = out
        .replace(/\\\\\(/g, "\\(")
        .replace(/\\\\\)/g, "\\)")
        .replace(/\\\\\[/g, "\\[")
        .replace(/\\\\\]/g, "\\]");
    out = normalizeTrigNotation(out);
    if (wrapInlineMath && !/\\\(|\\\[|\$/.test(out) && /\\(sin|cos|tan|cot|sec|csc)|\\pi|=/.test(out)) {
        out = `\\(${out}\\)`;
    }
    return out;
}

export default function InstaCuePlayer({ cards, onClose }: Props) {
    const updateRevisionCardStatus = useUserStore((s) => s.updateRevisionCardStatus);
    const [activeTab, setActiveTab] = useState<TabType>('new');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    // Local status overrides — so tab counts update even for demo cards not in store
    const [localStatuses, setLocalStatuses] = useState<Record<string, 'new' | 'unsure' | 'tomorrow' | 'know_it'>>({});

    // Group cards by status — prefer localStatuses override so demo cards also filter correctly
    const groupedCards = useMemo(() => {
        const defaultCards = cards.map(c => ({
            ...c,
            status: (localStatuses[c.id] ?? c.status ?? 'new') as 'new' | 'unsure' | 'tomorrow' | 'know_it',
        }));
        return {
            new: defaultCards.filter(c => c.status === 'new'),
            unsure: defaultCards.filter(c => c.status === 'unsure'),
            tomorrow: defaultCards.filter(c => c.status === 'tomorrow'),
            know_it: defaultCards.filter(c => c.status === 'know_it'),
            all: defaultCards,
        };
    }, [cards, localStatuses]);

    const activeCards = groupedCards[activeTab];
    const currentCard = activeCards[currentIndex];

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setCurrentIndex(0);
        setIsFlipped(false);
    };

    const handleStatusUpdate = (status: 'unsure' | 'tomorrow' | 'know_it') => {
        if (!currentCard) return;

        // Update local status map so tabs update immediately (works for demo cards too)
        setLocalStatuses(prev => ({ ...prev, [currentCard.id]: status }));

        // Also persist to store for real saved cards (skip demo deck IDs)
        updateRevisionCardStatus(currentCard.id, status);
        const stored = useUserStore.getState().user?.savedRevisionCards ?? [];
        if (stored.some((c) => c.id === currentCard.id)) {
          syncAllSavedContent().catch(() => {});
        }

        // Advance to next card in filtered tabs (card leaves the current filtered list)
        if (activeTab !== 'all') {
            // Card will leave this tab's list, so index stays and shows next card
            // But we must ensure index doesn't go out of bounds after re-render
            setCurrentIndex(prev => Math.max(0, prev));
        } else {
            // On 'All Cards' tab, move forward
            if (currentIndex < activeCards.length - 1) {
                setCurrentIndex(prev => prev + 1);
            }
        }
        setIsFlipped(false);
    };

    const nextCard = () => {
        if (currentIndex < activeCards.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const prevCard = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    const progressPercentage = activeCards.length === 0 ? 0 : Math.round(((currentIndex + 1) / activeCards.length) * 100);

    const TABS: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
        { id: 'new', label: 'New', icon: <Plus className="w-4 h-4" />, count: groupedCards.new.length },
        { id: 'unsure', label: 'Unsure', icon: <HelpCircle className="w-4 h-4" />, count: groupedCards.unsure.length },
        { id: 'tomorrow', label: 'Tomorrow', icon: <Clock className="w-4 h-4" />, count: groupedCards.tomorrow.length },
        { id: 'know_it', label: 'Know It', icon: <Check className="w-4 h-4" />, count: groupedCards.know_it.length },
        { id: 'all', label: 'All Cards', icon: <Layers className="w-4 h-4" />, count: groupedCards.all.length },
    ];

    return (
        <div className="w-full">
            <div className="max-w-4xl w-full">

                {/* Tabs */}
                <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-none">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex-1 min-w-[150px] flex flex-col items-center justify-center py-4 rounded-xl border transition-all ${activeTab === tab.id
                                ? 'bg-primary/15 border-primary/40 text-foreground shadow-sm'
                                : 'bg-card border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground shadow-sm'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {tab.icon}
                                </span>
                                <span className="text-[14px] font-semibold">{tab.label}</span>
                            </div>
                            <span className="text-[22px] font-extrabold text-foreground">{tab.count}</span>
                        </button>
                    ))}
                </div>

                {/* Progress */}
                <div className="flex flex-col mb-8">
                    <div className="flex items-center justify-between text-[13px] font-medium text-muted-foreground mb-2 px-1">
                        <span>Card {activeCards.length > 0 ? currentIndex + 1 : 0} of {activeCards.length}</span>
                        <span>{progressPercentage}% Complete</span>
                    </div>
                    <div className="h-[6px] w-full bg-muted rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            style={{ originX: 0 }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: progressPercentage / 100 }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>

                {/* Card Area */}
                <div className="flex flex-col items-center justify-start relative">
                    <AnimatePresence mode="wait">
                        {currentCard ? (
                            <motion.div
                                key={currentCard.id + (isFlipped ? '-back' : '-front')}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.2 }}
                                className="w-full max-w-2xl bg-card rounded-2xl shadow-sm border border-border p-5 md:p-6 cursor-pointer"
                                onClick={() => setIsFlipped(f => !f)}
                            >
                                {!isFlipped ? (
                                    // Front of Card
                                    <div className="flex flex-col h-full min-h-[230px]">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="px-3.5 py-1 bg-primary/20 text-primary text-[11px] font-semibold rounded-full capitalize">
                                                    {currentCard.type.replace('_', ' ')}
                                                </span>
                                                <span className="px-3.5 py-1 bg-muted text-muted-foreground text-[11px] font-medium rounded-full lowercase">
                                                    {currentCard.subject}
                                                </span>
                                            </div>
                                            <span className="px-3.5 py-1 bg-muted text-muted-foreground text-[11px] font-bold rounded-full uppercase tracking-wider">
                                                {currentCard.status === 'new' ? 'New' : currentCard.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <h2 className="text-[19px] font-bold text-foreground mb-3">
                                            <MathText as="span" weight="bold">
                                                {normalizeCardMath(currentCard.subtopicName, true)}
                                            </MathText>
                                        </h2>
                                        <div className="text-[15px] text-foreground/85 whitespace-pre-wrap flex-1 leading-relaxed">
                                            <MathText as="div" weight="semibold">
                                                {normalizeCardMath(currentCard.frontContent)}
                                            </MathText>
                                        </div>

                                        <div className="mt-6 flex justify-center w-full">
                                            <p className="text-muted-foreground text-[13px] flex items-center gap-2 font-medium">
                                                <RotateCcw className="w-4 h-4" /> Tap to reveal answer
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    // Back of Card
                                    <div className="flex flex-col h-full min-h-[230px]">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-[19px] font-bold text-primary">
                                                <MathText as="span" weight="bold">
                                                    {normalizeCardMath(currentCard.subtopicName, true)}
                                                </MathText>
                                            </h2>
                                            <span className="px-3.5 py-1 text-muted-foreground text-xs font-bold rounded-full border border-border">
                                                Answer
                                            </span>
                                        </div>

                                        <div className="text-[15px] text-foreground/90 whitespace-pre-wrap flex-1 leading-relaxed">
                                            <MathText as="div" weight="semibold">
                                                {normalizeCardMath(currentCard.backContent)}
                                            </MathText>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <div className="text-center p-12 bg-card rounded-2xl border border-dashed border-border w-full max-w-2xl">
                                <div className="w-16 h-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">You&apos;re all caught up!</h3>
                                <p className="text-muted-foreground">There are no cards in this section right now.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div className="mt-4 flex items-center justify-center gap-4 pb-4">
                    {currentCard && isFlipped ? (
                        <div className="flex flex-wrap items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <Button
                                variant="outline"
                                className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-7 py-5 rounded-[14px] font-semibold text-[14px] bg-card"
                                onClick={() => handleStatusUpdate('unsure')}
                            >
                                <HelpCircle className="w-[18px] h-[18px] mr-2" />
                                Unsure
                            </Button>
                            <Button
                                variant="outline"
                                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 px-7 py-5 rounded-[14px] font-semibold text-[14px] bg-card"
                                onClick={() => handleStatusUpdate('tomorrow')}
                            >
                                <Clock className="w-[18px] h-[18px] mr-2" />
                                Tomorrow
                            </Button>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-7 py-5 rounded-[14px] font-semibold text-[14px] border-none shadow-sm"
                                onClick={() => handleStatusUpdate('know_it')}
                            >
                                <Check className="w-[18px] h-[18px] mr-2" />
                                Know It
                            </Button>
                        </div>
                    ) : currentCard && !isFlipped ? (
                        <div className="flex items-center gap-8 text-muted-foreground font-semibold text-[15px]">
                            <button
                                className="flex items-center gap-2 hover:text-foreground transition-colors disabled:opacity-40"
                                onClick={prevCard}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </button>
                            <span className="w-px h-4 bg-border" />
                            <button
                                className="flex items-center gap-2 hover:text-foreground transition-colors disabled:opacity-40"
                                onClick={nextCard}
                                disabled={currentIndex === activeCards.length - 1}
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
