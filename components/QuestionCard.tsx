import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Question } from "@/types";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Share2,
  Lightbulb,
  Eye,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Bookmark,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { sanitizeMockHtml } from "@/lib/mock/mockHtml";

const subjectColors: Record<string, string> = {
  physics: "bg-edu-blue",
  chemistry: "bg-edu-purple",
  math: "bg-edu-orange",
};

const subjectEmoji: Record<string, string> = {
  physics: "⚡",
  chemistry: "🧪",
  math: "📐",
};

function OptionBody({ text }: { text: string }) {
  const t = text.trim();
  if (t.includes("<")) {
    return (
      <span
        className="prose prose-xs max-w-none flex-1 text-foreground dark:prose-invert sm:prose-sm [&_.math-tex]:text-inherit"
        // eslint-disable-next-line react/no-danger -- sanitized server/mock HTML
        dangerouslySetInnerHTML={{ __html: sanitizeMockHtml(t) }}
      />
    );
  }
  return <span className="flex-1">{t}</span>;
}

interface Props {
  question: Question;
  onNext: () => void;
  /** When set, mock test mode: hide save/like/share and RDM feedback; optional external answer capture */
  mockMode?: boolean;
  onAnswerSelect?: (selectedIndex: number) => void;
}

const QuestionCard = ({ question, onNext, mockMode, onAnswerSelect }: Props) => {
  const { recordAnswer, saveQuestion, unsaveQuestion, likeQuestion, unlikeQuestion, user } =
    useUserStore();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showReference, setShowReference] = useState(false);

  const isCorrect = selectedOption === question.correctAnswer;
  const isSaved = user?.savedQuestions.includes(question.id);
  const isLiked = user?.likedQuestions.includes(question.id);

  const handleAnswer = (index: number) => {
    if (answered) return;
    setSelectedOption(index);
    setAnswered(true);
    if (onAnswerSelect) {
      onAnswerSelect(index);
    } else {
      recordAnswer({
        questionId: question.id,
        selectedAnswer: index,
        isCorrect: index === question.correctAnswer,
        timestamp: Date.now(),
      });
      if (index === question.correctAnswer) {
        import("canvas-confetti").then((confetti) => {
          confetti.default({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        });
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Subject tag */}
      <div className="flex items-center gap-2">
        <span
          className={`${subjectColors[question.subject]} text-primary-foreground text-xs font-bold px-3 py-1 rounded-full`}
        >
          {subjectEmoji[question.subject]}{" "}
          {question.subject.charAt(0).toUpperCase() + question.subject.slice(1)}
        </span>
        <span className="text-xs text-muted-foreground">{question.topic}</span>
      </div>

      {/* Question */}
      <div className="bg-card rounded-xl p-3.5 shadow-lg border border-border sm:rounded-2xl sm:p-5">
        {question.questionHtml ? (
          <div
            className="prose prose-sm mb-3 max-w-none font-bold leading-snug text-foreground dark:prose-invert [&_p]:my-1.5 sm:prose-base sm:mb-4 sm:[&_p]:my-2 lg:prose-lg lg:[&_p]:my-2.5 [&_strong]:text-foreground"
            // eslint-disable-next-line react/no-danger -- sanitized mock bank HTML
            dangerouslySetInnerHTML={{ __html: sanitizeMockHtml(question.questionHtml) }}
          />
        ) : (
          <h3 className="mb-3 text-sm font-bold leading-snug text-foreground sm:mb-4 sm:text-base lg:text-lg">
            {question.question}
          </h3>
        )}

        {/* Options */}
        <div className="space-y-1.5 sm:space-y-2">
          {question.options.map((option, i) => {
            let optionClass = "bg-muted hover:bg-muted/80 text-foreground";
            if (answered) {
              if (i === question.correctAnswer) {
                optionClass = "bg-accent/20 border-2 border-accent text-foreground";
              } else if (i === selectedOption && !isCorrect) {
                optionClass = "bg-destructive/20 border-2 border-destructive text-foreground";
              } else {
                optionClass = "bg-muted/50 text-muted-foreground";
              }
            } else if (i === selectedOption) {
              optionClass = "bg-primary/20 border-2 border-primary text-foreground";
            }

            return (
              <motion.button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                whileTap={!answered ? { scale: 0.98 } : undefined}
                className={`w-full text-left p-2 rounded-lg font-semibold text-xs transition-all flex items-center gap-1.5 sm:p-3 sm:rounded-xl sm:text-sm sm:gap-2 ${optionClass}`}
              >
                <span className="w-5 h-5 rounded-full bg-background/50 flex items-center justify-center text-[10px] font-bold shrink-0 sm:w-7 sm:h-7 sm:text-xs">
                  {String.fromCharCode(65 + i)}
                </span>
                <OptionBody text={option} />
                {answered && i === question.correctAnswer && (
                  <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                )}
                {answered && i === selectedOption && !isCorrect && i !== question.correctAnswer && (
                  <XCircle className="w-5 h-5 text-destructive shrink-0" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Result feedback (hidden in mock mode) */}
        {!mockMode && (
          <AnimatePresence>
            {answered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3"
              >
                {isCorrect ? (
                  <div className="bg-accent/10 rounded-xl p-3 text-center">
                    <span className="text-accent font-bold">✅ Correct! +10 RDM</span>
                  </div>
                ) : (
                  <motion.div
                    animate={{ x: [0, -5, 5, -5, 0] }}
                    className="bg-destructive/10 rounded-xl p-3 text-center"
                  >
                    <span className="text-destructive font-bold">❌ Wrong! -5 RDM</span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHint(!showHint)}
          className="rounded-full text-xs"
        >
          <Lightbulb className="w-3.5 h-3.5 mr-1" />
          {showHint ? "Hide" : "Hint"}
        </Button>
        {answered && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSolution(!showSolution)}
            className="rounded-full text-xs"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            {showSolution ? "Hide" : "Solution"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowReference(!showReference)}
          className="rounded-full text-xs"
        >
          <BookOpen className="w-3.5 h-3.5 mr-1" />
          Reference{" "}
          {showReference ? (
            <ChevronUp className="w-3 h-3 ml-0.5" />
          ) : (
            <ChevronDown className="w-3 h-3 ml-0.5" />
          )}
        </Button>
        <div className="flex-1" />
        {!mockMode && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (isLiked ? unlikeQuestion(question.id) : likeQuestion(question.id))}
              className="rounded-full"
            >
              <Heart className={`w-4 h-4 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (isSaved ? unsaveQuestion(question.id) : saveQuestion(question.id))}
              className="rounded-full"
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? "fill-primary text-primary" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.share?.({ text: question.question }).catch(() => {})}
              className="rounded-full"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Expandable sections */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-edu-yellow/10 rounded-xl p-4 border border-edu-yellow/30"
          >
            <p className="text-sm text-foreground">💡 {question.hint}</p>
          </motion.div>
        )}
        {showSolution && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-accent/10 rounded-lg p-3 border border-accent/30 sm:rounded-xl sm:p-4"
          >
            <h4 className="font-bold text-xs text-foreground mb-0.5 sm:text-sm sm:mb-1">📝 Solution</h4>
            {question.solutionHtml ? (
              <div
                className="prose prose-xs max-w-none text-foreground/90 dark:prose-invert [&_img]:max-h-32 sm:prose-sm sm:[&_img]:max-h-48 [&_img]:w-auto"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: sanitizeMockHtml(question.solutionHtml) }}
              />
            ) : (
              <p className="text-xs text-foreground/80 sm:text-sm">{question.solution}</p>
            )}
          </motion.div>
        )}
        {showReference && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-muted rounded-lg p-3 space-y-2.5 sm:rounded-xl sm:p-4 sm:space-y-3"
          >
            <div>
              <h4 className="font-bold text-xs text-foreground mb-0.5 sm:text-sm sm:mb-1">📖 Theory</h4>
              <p className="text-xs text-muted-foreground sm:text-sm">{question.reference.theory}</p>
            </div>
            {question.reference.inventor && (
              <div>
                <h4 className="font-bold text-sm text-foreground mb-1">👤 Inventor</h4>
                <p className="text-sm text-muted-foreground">{question.reference.inventor}</p>
              </div>
            )}
            <div>
              <h4 className="font-bold text-sm text-foreground mb-1">🔗 Related Topics</h4>
              <div className="flex gap-1 flex-wrap">
                {question.reference.relatedTopics.map((t) => (
                  <span
                    key={t}
                    className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-semibold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground mb-1">🌍 Application</h4>
              <p className="text-sm text-muted-foreground">
                {question.reference.applicationExample}
              </p>
            </div>
            {question.reference.youtubeUrl && (
              <div>
                <h4 className="font-bold text-sm text-foreground mb-1">🎬 Video</h4>
                <div className="rounded-xl overflow-hidden aspect-video">
                  <iframe
                    src={question.reference.youtubeUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Reference Video"
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next button */}
      {answered && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button
            onClick={onNext}
            size="lg"
            className="w-full rounded-xl font-bold gradient-primary text-primary-foreground border-0"
          >
            Next Question →
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default QuestionCard;
