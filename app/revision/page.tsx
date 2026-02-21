"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import { useUserStore } from '@/store/useUserStore';
import { questions } from '@/data/questions';
import QuestionCard from '@/components/QuestionCard';
import { BookMarked, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SavedRevisionCard, RevisionCardType } from '@/types';
import { ProtectedRoute } from "@/components/ProtectedRoute";
import InstaCuePlayer from '@/components/InstaCuePlayer';
import AddRevisionCardModal from '@/components/AddRevisionCardModal';

const DEMO_CARDS: SavedRevisionCard[] = [
  {
    id: 'demo-1',
    type: 'formula',
    frontContent: 'What is Newton\'s Second Law of Motion?',
    backContent: 'F = ma\n\nForce equals mass times acceleration. The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass.',
    subtopicName: 'Newton\'s Second Law',
    topic: 'Laws of Motion',
    subject: 'physics',
    classLevel: 11,
    status: 'new'
  },
  {
    id: 'demo-2',
    type: 'concept',
    frontContent: 'What is the powerhouse of the cell?',
    backContent: 'Mitochondria\n\nThey generate most of the chemical energy needed to power the cell\'s biochemical reactions.',
    subtopicName: 'Cellular Respiration',
    topic: 'Cell Biology',
    subject: 'biology',
    classLevel: 10,
    status: 'new'
  },
  {
    id: 'demo-3',
    type: 'common_mistake',
    frontContent: 'Does (x + y)² equal x² + y²?',
    backContent: 'No, (x + y)² = x² + 2xy + y²\n\nForgetting the middle term (2xy) is a very common algebraic mistake.',
    subtopicName: 'Binomial Expansion',
    topic: 'Algebra',
    subject: 'math',
    classLevel: 9,
    status: 'new'
  },
];

const Revision = () => {
  const user = useUserStore((s) => s.user);
  const unsaveQuestion = useUserStore((s) => s.unsaveQuestion);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const savedQuestions = questions.filter((q) => user?.savedQuestions.includes(q.id));
  const savedCards = user?.savedRevisionCards ?? [];
  const displayCards = savedCards.length > 0 ? savedCards : DEMO_CARDS;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 pt-1 pb-8">

          {/* Header */}
          <div className="mb-5">
            <h1 className="text-[24px] font-bold text-[#1e293b] tracking-tight">
              <span className="text-[#f59e0b] font-extrabold">Insta</span>
              <span className="text-[#1e293b] font-extrabold">Cue</span>
              <span className="text-[#1e293b] font-bold"> Cards</span>
            </h1>
            <p className="text-[#64748b] text-[13px] mt-0.5 font-medium">
              Quick revision flashcards with active recall and spaced repetition
            </p>
          </div>

          {/* InstaCue Player rendered inline */}
          <InstaCuePlayer
            cards={displayCards}
            onClose={() => { }}
          />

          {/* Saved Questions section below if any */}
          {savedQuestions.length > 0 && (
            <section className="mt-16">
              <h3 className="text-[13px] font-bold text-[#94a3b8] mb-4 uppercase tracking-wider">
                Saved Questions
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {savedQuestions.map((q, i) => (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    {activeId === q.id ? (
                      <div className="sm:col-span-2">
                        <QuestionCard question={q} onNext={() => setActiveId(null)} />
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveId(q.id)}
                        className="w-full edu-card p-5 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="edu-chip bg-primary/10 text-primary mb-2">
                              {q.subject} · {q.topic}
                            </span>
                            <p className="text-sm font-bold text-foreground mt-2 line-clamp-2">
                              {q.question}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              unsaveQuestion(q.id);
                            }}
                            className="shrink-0 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Floating Action Button */}
        <div className="fixed bottom-8 right-8 z-40">
          <Button
            size="icon"
            className="w-14 h-14 rounded-full shadow-lg bg-[#172033] hover:bg-[#1f2b44] text-white"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>

        <AddRevisionCardModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />

      </AppLayout>
    </ProtectedRoute>
  );
}

export default Revision;
