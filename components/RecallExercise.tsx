import { useState } from 'react';
import { motion } from 'framer-motion';
import { AnswerResult } from '@/types';
import { questions } from '@/data/questions';
import { Brain, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  secondsLeft: number;
  recentResults: AnswerResult[];
}

const RecallExercise = ({ secondsLeft, recentResults }: Props) => {
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const recentQuestions = recentResults
    .slice(-5)
    .map((r) => {
      const q = questions.find((q) => q.id === r.questionId);
      return q ? { question: q, result: r } : null;
    })
    .filter(Boolean) as { question: (typeof questions)[0]; result: AnswerResult }[];

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center p-4"
    >
      <div className="max-w-sm w-full space-y-4">
        <div className="text-center space-y-2">
          <Brain className="w-10 h-10 text-edu-blue mx-auto" />
          <h2 className="text-xl font-display text-foreground">Recall Exercise 🧠</h2>
          <p className="text-muted-foreground text-xs">
            Try to recall the answers before revealing them!
          </p>
          <div className="bg-edu-blue/10 rounded-full px-3 py-1 inline-flex items-center gap-1.5">
            <span className="text-sm font-bold text-edu-blue">
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {recentQuestions.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No questions to recall yet. Keep playing!
            </p>
          ) : (
            recentQuestions.map(({ question, result }) => (
              <div key={question.id} className="bg-card rounded-xl p-3 border border-border">
                <p className="text-sm font-bold text-foreground mb-2">{question.question}</p>
                {revealedIds.has(question.id) ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`rounded-lg p-2 text-xs font-bold ${
                      result.isCorrect
                        ? 'bg-accent/10 text-accent'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {result.isCorrect ? '✅' : '❌'} {question.options[question.correctAnswer]}
                  </motion.div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleReveal(question.id)}
                    className="rounded-full text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1" /> Reveal
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RecallExercise;
