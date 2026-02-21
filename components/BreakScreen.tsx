import { useState } from 'react';
import { motion } from 'framer-motion';
import { breakActivities, BreakActivity } from '@/data/breakActivities';
import { Coffee, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  secondsLeft: number;
}

const BreakScreen = ({ secondsLeft }: Props) => {
  const [activity, setActivity] = useState<BreakActivity>(
    () => breakActivities[Math.floor(Math.random() * breakActivities.length)]
  );
  const [showAnswer, setShowAnswer] = useState(false);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const nextActivity = () => {
    setShowAnswer(false);
    const remaining = breakActivities.filter((a) => a.id !== activity.id);
    setActivity(remaining[Math.floor(Math.random() * remaining.length)]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex items-center justify-center p-6"
    >
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex flex-col items-center gap-2">
          <Coffee className="w-12 h-12 text-edu-orange" />
          <h2 className="text-2xl font-display text-foreground">Break Time! ☕</h2>
          <p className="text-muted-foreground text-sm">
            You earned <span className="font-bold text-primary">+50 RDM</span> for your 25-min streak!
          </p>
        </div>

        <div className="bg-edu-orange/10 rounded-full px-4 py-2 inline-flex items-center gap-2">
          <span className="text-lg font-bold text-edu-orange">
            {mins}:{secs.toString().padStart(2, '0')}
          </span>
          <span className="text-xs text-muted-foreground">remaining</span>
        </div>

        <div className="bg-card rounded-2xl p-5 border border-border shadow-lg text-left space-y-3">
          <h3 className="font-bold text-foreground">{activity.title}</h3>
          <p className="text-sm text-foreground/80">{activity.content}</p>
          {activity.answer && (
            <>
              {showAnswer ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-accent/10 rounded-xl p-3"
                >
                  <p className="text-sm font-bold text-accent">{activity.answer}</p>
                </motion.div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnswer(true)}
                  className="rounded-full text-xs"
                >
                  Reveal Answer
                </Button>
              )}
            </>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={nextActivity} className="rounded-full text-xs">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Next Activity
        </Button>
      </div>
    </motion.div>
  );
};

export default BreakScreen;
