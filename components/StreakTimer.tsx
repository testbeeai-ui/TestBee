import { StreakPhase } from '@/types';
import { Timer, Coffee, Brain } from 'lucide-react';

interface Props {
  phase: StreakPhase;
  secondsLeft: number;
  totalSeconds: number;
}

const phaseConfig: Record<StreakPhase, { label: string; icon: typeof Timer; colorClass: string }> = {
  playing: { label: 'Streak', icon: Timer, colorClass: 'text-primary' },
  break: { label: 'Break', icon: Coffee, colorClass: 'text-edu-orange' },
  recall: { label: 'Recall', icon: Brain, colorClass: 'text-edu-blue' },
};

const StreakTimer = ({ phase, secondsLeft, totalSeconds }: Props) => {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const { label, icon: Icon, colorClass } = phaseConfig[phase];
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  return (
    <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-full">
      <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
      <span className={`text-xs font-bold ${colorClass}`}>
        {mins}:{secs.toString().padStart(2, '0')}
      </span>
      <div className="w-8 h-1.5 bg-background rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            phase === 'playing' ? 'bg-primary' : phase === 'break' ? 'bg-edu-orange' : 'bg-edu-blue'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default StreakTimer;
