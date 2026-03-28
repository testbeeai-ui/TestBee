import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/useUserStore';
import { syncAllSavedContent } from '@/lib/savedContentService';
import { RevisionCardType, Subject } from '@/types';
import { Brain, Calculator, AlertTriangle, Lightbulb, Plus } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const CARD_TYPES: { value: RevisionCardType; label: string; icon: React.ReactNode; colorClass: string }[] = [
    { value: 'concept', label: 'Concept', icon: <Brain className="w-4 h-4" />, colorClass: 'bg-amber-100 text-amber-800 border-amber-500' },
    { value: 'formula', label: 'Formula', icon: <Calculator className="w-4 h-4" />, colorClass: 'bg-slate-100 text-slate-700 border-slate-500' },
    { value: 'common_mistake', label: 'Mistake', icon: <AlertTriangle className="w-4 h-4" />, colorClass: 'bg-red-50 text-red-700 border-red-500' },
    { value: 'trap', label: 'Trap', icon: <Lightbulb className="w-4 h-4" />, colorClass: 'bg-violet-50 text-violet-700 border-violet-500' },
];

export default function AddRevisionCardModal({ isOpen, onClose }: Props) {
    const saveRevisionCard = useUserStore((s) => s.saveRevisionCard);
    const [title, setTitle] = useState('');
    const [front, setFront] = useState('');
    const [back, setBack] = useState('');
    const [subject, setSubject] = useState('');
    const [type, setType] = useState<RevisionCardType>('concept');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !front || !back || !subject) return;

        saveRevisionCard({
            id: crypto.randomUUID(),
            type,
            frontContent: front,
            backContent: back,
            subtopicName: title,
            topic: 'Custom',
            subject: subject.toLowerCase() as Subject,
            classLevel: 12,
            status: 'new',
        });
        syncAllSavedContent().catch(() => {});

        // Reset form
        setTitle('');
        setFront('');
        setBack('');
        setSubject('');
        setType('concept');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] p-6">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Add New Card</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input
                            placeholder="e.g., Newton's Third Law"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Front (Question/Trigger)</label>
                        <Textarea
                            placeholder="What you want to remember..."
                            value={front}
                            onChange={(e) => setFront(e.target.value)}
                            required
                            className="resize-none"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Back (Answer/Explanation)</label>
                        <Textarea
                            placeholder="The answer or explanation..."
                            value={back}
                            onChange={(e) => setBack(e.target.value)}
                            required
                            className="resize-none"
                            rows={4}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Subject</label>
                        <Input
                            placeholder="e.g., Physics"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <div className="flex flex-wrap gap-2">
                            {CARD_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setType(t.value)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${type === t.value
                                            ? t.colorClass.split(' ').slice(0, 2).join(' ') + ' border-transparent ring-2 ring-primary/20'
                                            : 'bg-background hover:bg-muted border-border text-muted-foreground'
                                        }`}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button type="submit" className="w-full mt-6 bg-[#172033] hover:bg-[#1f2b44] text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Card
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
