"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/useUserStore';
import { pricingPlans } from '@/data/pricing';
import { Button } from '@/components/ui/button';
import { Check, Crown, Lock, Sparkles, Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const premiumFeatures = [
  { name: 'Past Papers', desc: 'Access past exam papers', icon: '📄' },
  { name: 'Mock Tests', desc: 'Full-length timed tests', icon: '📝' },
  { name: 'Adaptive Tests', desc: 'Difficulty adjusts to you', icon: '🎯' },
  { name: 'FITRICE Framework', desc: 'Structured learning path', icon: '🧠' },
];

import { ProtectedRoute } from "@/components/ProtectedRoute";

const Pricing = () => {
  const { profile, session, refreshProfile } = useAuth();
  const user = useUserStore((s) => s.user);
  const topUpRdm = useUserStore((s) => s.topUpRdm);
  const { toast } = useToast();
  const [purchased, setPurchased] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rdm = profile?.rdm ?? user?.rdm ?? 0;

  const handlePurchase = async (planId: string, rdmAmount: number) => {
    setLoading(true);
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    try {
      const res = await fetch('/api/rdm/top-up', {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: rdmAmount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: 'Top-up failed', description: (data as { error?: string })?.error ?? 'Try again.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const newRdm = (data as { rdm?: number }).rdm;
      if (typeof newRdm === 'number') useUserStore.getState().setRdmFromProfile(newRdm);
      await refreshProfile();
      setPurchased(planId);
      import('canvas-confetti').then((confetti) => {
        confetti.default({ particleCount: 100, spread: 70 });
      });
      setTimeout(() => setPurchased(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="edu-page-header">
          <h2 className="edu-page-title flex items-center gap-3">
            <div className="w-10 h-10 bg-edu-yellow/20 rounded-xl flex items-center justify-center">
              <Crown className="w-5 h-5 text-edu-yellow" />
            </div>
            Plans & Top-up
          </h2>
          <p className="edu-page-desc">Top up RDM and unlock premium features</p>
        </div>

        {/* Current balance */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="edu-card p-6 mb-8 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-edu-orange/10 rounded-xl flex items-center justify-center">
              <Coins className="w-5 h-5 text-edu-orange" />
            </div>
            <span className="text-muted-foreground font-bold">Current Balance</span>
          </div>
          <span className="font-extrabold text-3xl text-foreground">{rdm} <span className="text-sm text-muted-foreground">RDM</span></span>
        </motion.div>

        {/* Plans */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {pricingPlans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.02 }}
              className={`edu-card p-6 relative ${
                plan.recommended ? 'border-2 border-primary shadow-lg ring-2 ring-primary/10' : ''
              }`}
            >
              {plan.recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                  <Sparkles className="w-3 h-3" /> BEST VALUE
                </span>
              )}
              <h3 className="font-extrabold text-lg text-foreground mt-1">{plan.name}</h3>
              <p className="text-2xl font-extrabold text-primary mb-4">{plan.price}</p>
              <ul className="space-y-2 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                    <Check className="w-4 h-4 text-edu-green shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {plan.id !== 'free' && (
                <Button
                  onClick={() => handlePurchase(plan.id, plan.rdmAmount)}
                  disabled={purchased === plan.id || loading}
                  className="w-full edu-btn-primary"
                >
                  {purchased === plan.id ? '✅ Done!' : loading ? '...' : `Get ${plan.rdmAmount} RDM`}
                </Button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Premium Features */}
        <h3 className="font-display text-lg text-foreground mb-4">Premium Features</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {premiumFeatures.map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              className="edu-card p-5 relative overflow-hidden"
            >
              <div className="text-3xl mb-2">{f.icon}</div>
              <h4 className="font-extrabold text-sm text-foreground">{f.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                <span className="edu-chip bg-primary/10 text-primary">
                  <Lock className="w-3 h-3" /> Premium
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
    </ProtectedRoute>
  );
}

export default Pricing;
