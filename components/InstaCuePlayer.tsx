import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUserStore } from '@/store/useUserStore';
import { syncAllSavedContent } from '@/lib/savedContentService';
import { SavedRevisionCard } from '@/types';
import { Plus, HelpCircle, Clock, Check, Layers, X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    cards: SavedRevisionCard[];
    onClose: () => void;
}

type TabType = 'new' | 'unsure' | 'tomorrow' | 'know_it' | 'all';

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
                                ? 'bg-[#e2e8f0]/60 border-[#cbd5e1] text-[#0f172a] shadow-sm'
                                : 'bg-white border-transparent text-[#64748b] hover:border-slate-200 hover:text-slate-700 shadow-sm'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`${activeTab === tab.id ? 'text-[#0f172a]' : 'text-slate-400'}`}>
                                    {tab.icon}
                                </span>
                                <span className="text-[14px] font-semibold">{tab.label}</span>
                            </div>
                            <span className={`text-[22px] font-extrabold text-[#0f172a]`}>{tab.count}</span>
                        </button>
                    ))}
                </div>

                {/* Progress */}
                <div className="flex flex-col mb-8">
                    <div className="flex items-center justify-between text-[13px] font-medium text-[#1e293b] mb-2 px-1">
                        <span>Card {activeCards.length > 0 ? currentIndex + 1 : 0} of {activeCards.length}</span>
                        <span>{progressPercentage}% Complete</span>
                    </div>
                    <div className="h-[6px] w-full bg-[#f1f5f9] rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-[#1e3a8a]"
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
                                className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border p-5 md:p-6 cursor-pointer"
                                onClick={() => setIsFlipped(f => !f)}
                            >
                                {!isFlipped ? (
                                    // Front of Card
                                    <div className="flex flex-col h-full min-h-[230px]">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="px-3.5 py-1 bg-[#212b36] text-white text-[11px] font-semibold rounded-full capitalize">
                                                    {currentCard.type.replace('_', ' ')}
                                                </span>
                                                <span className="px-3.5 py-1 bg-[#f1f5f9] text-[#64748b] text-[11px] font-medium rounded-full lowercase">
                                                    {currentCard.subject}
                                                </span>
                                            </div>
                                            <span className="px-3.5 py-1 bg-[#f1f5f9] text-[#64748b] text-[11px] font-bold rounded-full uppercase tracking-wider">
                                                {currentCard.status === 'new' ? 'New' : currentCard.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <h2 className="text-[19px] font-bold text-[#1a2b4b] mb-3">{currentCard.subtopicName}</h2>
                                        <p className="text-[15px] text-[#475569] whitespace-pre-wrap flex-1 leading-relaxed">{currentCard.frontContent}</p>

                                        <div className="mt-6 flex justify-center w-full">
                                            <p className="text-[#94a3b8] text-[13px] flex items-center gap-2 font-medium">
                                                <RotateCcw className="w-4 h-4" /> Tap to reveal answer
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    // Back of Card
                                    <div className="flex flex-col h-full min-h-[230px]">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-[19px] font-bold text-[#d97706]">{currentCard.subtopicName}</h2>
                                            <span className="px-3.5 py-1 text-[#64748b] text-xs font-bold rounded-full border border-slate-200">
                                                Answer
                                            </span>
                                        </div>

                                        <div className="text-[15px] text-[#334155] whitespace-pre-wrap flex-1 leading-relaxed">
                                            {currentCard.backContent}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-slate-300 w-full max-w-2xl">
                                <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">You're all caught up!</h3>
                                <p className="text-slate-500">There are no cards in this section right now.</p>
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
                                className="border-red-500 text-red-500 hover:bg-red-50 hover:text-red-500 px-7 py-5 rounded-[14px] font-semibold text-[14px] bg-white"
                                onClick={() => handleStatusUpdate('unsure')}
                            >
                                <HelpCircle className="w-[18px] h-[18px] mr-2" />
                                Unsure
                            </Button>
                            <Button
                                variant="outline"
                                className="border-amber-500 text-amber-600 hover:bg-amber-50 hover:text-amber-600 px-7 py-5 rounded-[14px] font-semibold text-[14px] bg-white"
                                onClick={() => handleStatusUpdate('tomorrow')}
                            >
                                <Clock className="w-[18px] h-[18px] mr-2" />
                                Tomorrow
                            </Button>
                            <Button
                                className="bg-[#10b981] hover:bg-[#059669] text-white px-7 py-5 rounded-[14px] font-semibold text-[14px] border-none shadow-sm"
                                onClick={() => handleStatusUpdate('know_it')}
                            >
                                <Check className="w-[18px] h-[18px] mr-2" />
                                Know It
                            </Button>
                        </div>
                    ) : currentCard && !isFlipped ? (
                        <div className="flex items-center gap-8 text-[#94a3b8] font-semibold text-[15px]">
                            <button
                                className="flex items-center gap-2 hover:text-[#64748b] transition-colors disabled:opacity-40"
                                onClick={prevCard}
                                disabled={currentIndex === 0}
                            >
                                <ChevronLeft className="w-4 h-4" /> Previous
                            </button>
                            <span className="w-px h-4 bg-slate-200" />
                            <button
                                className="flex items-center gap-2 text-[#475569] hover:text-[#0f172a] transition-colors disabled:opacity-40"
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
