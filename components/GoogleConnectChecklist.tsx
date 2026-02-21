import { useState } from 'react';
import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Shield, ArrowRight } from 'lucide-react';

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

const items = [
  { id: 'account', label: 'I have a Google account (Workspace or Gmail)' },
  { id: 'admin', label: 'If school account: my admin allows Classroom access (optional)' },
  { id: 'understand', label: 'I understand: Classroom is the "official record"; ESM adds social learning + fun' },
];

const GoogleConnectChecklist = ({ onContinue, onSkip }: Props) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = items.every(i => checked[i.id]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-3xl p-8 shadow-2xl w-full max-w-md border border-border/50">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Shield className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-display text-foreground">Before connecting Google</h2>
        <p className="text-sm text-muted-foreground mt-1">Quick checklist to ensure a smooth setup</p>
      </div>

      <div className="space-y-4 mb-6">
        {items.map(item => (
          <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
            <Checkbox
              checked={!!checked[item.id]}
              onCheckedChange={v => setChecked(prev => ({ ...prev, [item.id]: !!v }))}
              className="mt-0.5"
            />
            <span className="text-sm text-foreground font-medium group-hover:text-primary transition-colors">{item.label}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onSkip} className="rounded-xl flex-1">
          Skip (ESM-only)
        </Button>
        <Button onClick={onContinue} disabled={!allChecked} className="rounded-xl edu-btn-primary flex-1 gap-1">
          Connect Google <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default GoogleConnectChecklist;
