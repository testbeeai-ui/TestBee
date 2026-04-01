"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { SubTopic } from "@/data/topicTaxonomy";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { X, RotateCw, Check, ChevronRight, Sparkles, BookOpen, Flame, Zap } from "lucide-react";

const VIBRANT = [
  "#FF3366", "#FF6B2B", "#FFB800", "#00C9A7",
  "#0088FF", "#7B2FF7", "#FF0099", "#3A86FF",
  "#FF5500", "#8B5CF6", "#06BCC1", "#E63946",
];

const DIFFICULTY_TIERS = [
  {
    id: "basics" as const,
    label: "Basics",
    subtitle: "Build foundations",
    level: "I",
    icon: BookOpen,
    gradient: "from-emerald-500 to-teal-600",
    glow: "rgba(16, 185, 129, 0.35)",
    border: "border-emerald-500/60",
    bg: "bg-emerald-500/10",
  },
  {
    id: "intermediate" as const,
    label: "Intermediate",
    subtitle: "Level up your skills",
    level: "II",
    icon: Flame,
    gradient: "from-amber-500 to-orange-600",
    glow: "rgba(245, 158, 11, 0.35)",
    border: "border-amber-500/60",
    bg: "bg-amber-500/10",
  },
  {
    id: "advanced" as const,
    label: "Advanced",
    subtitle: "Master the topic",
    level: "III",
    icon: Zap,
    gradient: "from-violet-500 to-fuchsia-600",
    glow: "rgba(139, 92, 246, 0.4)",
    border: "border-violet-500/60",
    bg: "bg-violet-500/10",
  },
] as const;

function lighten(hex: string, p: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (n >> 16) + Math.round(2.55 * p));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(2.55 * p));
  const b = Math.min(255, (n & 0xff) + Math.round(2.55 * p));
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, p: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - Math.round(2.55 * p));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(2.55 * p));
  const b = Math.max(0, (n & 0xff) - Math.round(2.55 * p));
  return `rgb(${r},${g},${b})`;
}

export type DifficultyLevel = "basics" | "intermediate" | "advanced";

interface TopicRouletteProps {
  subtopics: SubTopic[];
  /** Called with (subtopicIndex, difficultyLevel). Parent can navigate to topic page. */
  onSelect: (index: number, level: DifficultyLevel) => void;
  onClose: () => void;
}

export default function TopicRoulette({
  subtopics,
  onSelect,
  onClose,
}: TopicRouletteProps) {
  const topics = subtopics.map((s) => s.name);
  const n = Math.max(1, topics.length);
  const segAngle = 360 / n;
  const getColor = (i: number) => VIBRANT[i % VIBRANT.length];

  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [flapAngle, setFlapAngle] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const curRot = useRef(0);
  const animFrame = useRef<number | null>(null);
  const lastPeg = useRef(-1);

  // Single topic: skip roulette
  useEffect(() => {
    if (n <= 1) {
      onSelect(0, "basics");
      onClose();
    }
  }, [n, onSelect, onClose]);

  // Flapper physics during spin
  useEffect(() => {
    if (!spinning) {
      queueMicrotask(() => {
        setFlapAngle(0);
        lastPeg.current = -1;
      });
      return;
    }
    const norm = ((rotation % 360) + 360) % 360;
    const pegSpace = 360 / (n * 2);
    const pegIdx = Math.floor(norm / pegSpace);
    if (pegIdx !== lastPeg.current) {
      lastPeg.current = pegIdx;
      queueMicrotask(() => setFlapAngle(-22));
      setTimeout(() => setFlapAngle(10), 50);
      setTimeout(() => setFlapAngle(-5), 100);
      setTimeout(() => setFlapAngle(0), 150);
    }
  }, [rotation, spinning, n]);

  // Draw wheel on canvas
  useEffect(() => {
    if (n <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 10;
    const wheelR = outerR - 8;

    ctx.clearRect(0, 0, size, size);

    // Chrome ring
    for (let r = outerR + 5; r >= outerR - 2; r -= 0.5) {
      const t = (r - (outerR - 2)) / 7;
      const v = Math.round(180 + 60 * Math.sin(t * Math.PI));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgb(${v},${v},${v + 5})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // White base
    ctx.beginPath();
    ctx.arc(cx, cy, wheelR, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // Segments
    for (let i = 0; i < n; i++) {
      const sa = (i * segAngle - 90) * (Math.PI / 180);
      const ea = ((i + 1) * segAngle - 90) * (Math.PI / 180);
      const col = getColor(i);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, wheelR - 1, sa, ea);
      ctx.closePath();

      const ma = (sa + ea) / 2;
      const gx = cx + Math.cos(ma) * wheelR * 0.5;
      const gy = cy + Math.sin(ma) * wheelR * 0.5;
      const grad = ctx.createRadialGradient(cx, cy, 15, gx, gy, wheelR);
      grad.addColorStop(0, lighten(col, 20));
      grad.addColorStop(0.5, col);
      grad.addColorStop(1, darken(col, 12));
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sa) * wheelR, cy + Math.sin(sa) * wheelR);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const tmid = (sa + ea) / 2;
      const tR = wheelR * 0.58;
      ctx.save();
      ctx.translate(cx + Math.cos(tmid) * tR, cy + Math.sin(tmid) * tR);
      ctx.rotate(tmid + Math.PI / 2);
      const fs = n <= 6 ? 22 : n <= 10 ? 18 : 14;
      ctx.font = `800 ${fs}px 'Outfit', -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 4;
      ctx.fillText(String(i + 1), 0, 0);
      ctx.shadowColor = "transparent";
      ctx.restore();
    }

    // Pegs
    const pegR = wheelR - 5;
    for (let i = 0; i < n * 2; i++) {
      const a = ((i * 360) / (n * 2) - 90) * (Math.PI / 180);
      const px = cx + Math.cos(a) * pegR;
      const py = cy + Math.sin(a) * pegR;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      const pg = ctx.createRadialGradient(px - 1, py - 1, 0, px, py, 3.5);
      pg.addColorStop(0, "#fff");
      pg.addColorStop(0.6, "#eee");
      pg.addColorStop(1, "#ccc");
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Center hub (fixed proportion for size 300)
    const hr = 34;
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, hr + 5, 0, Math.PI * 2);
    const cg1 = ctx.createLinearGradient(cx - hr, cy - hr, cx + hr, cy + hr);
    cg1.addColorStop(0, "#E8E8EC");
    cg1.addColorStop(0.5, "#F5F5F7");
    cg1.addColorStop(1, "#D0D0D4");
    ctx.fillStyle = cg1;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    const hg = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, hr);
    hg.addColorStop(0, "#2D2B55");
    hg.addColorStop(0.5, "#1E1E30");
    hg.addColorStop(1, "#141420");
    ctx.beginPath();
    ctx.arc(cx, cy, hr, 0, Math.PI * 2);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [topics, n, segAngle]);

  const spin = useCallback(() => {
    if (spinning || n <= 1) return;
    setSpinning(true);
    setShowResult(false);
    setSelectedIndex(null);

    const spins = 6 + Math.random() * 4;
    const target = Math.floor(Math.random() * n);
    const tAngle = 360 - (target * segAngle + segAngle / 2);
    const total = spins * 360 + tAngle;
    const start = curRot.current;
    const end = start + total;
    const dur = 5000 + Math.random() * 2000;
    const t0 = performance.now();

    const ease = (t: number) => {
      if (t < 0.35) return t * 2.5 * t;
      if (t < 0.75) return 0.306 + (1 - 0.306) * 0.82 * ((t - 0.35) / 0.4);
      const p = (t - 0.75) / 0.25;
      return 0.306 + (1 - 0.306) * 0.82 + (1 - 0.306) * 0.18 * (1 - Math.pow(1 - p, 5));
    };

    const anim = (now: number) => {
      const prog = Math.min((now - t0) / dur, 1);
      const e = ease(prog);
      const c = start + total * e;
      setRotation(c);
      curRot.current = c;
      if (prog < 1) {
        animFrame.current = requestAnimationFrame(anim);
      } else {
        curRot.current = end;
        setRotation(end);
        setSpinning(false);
        // Derive selected index from final rotation so the label matches the segment under the flapper
        const norm = ((end % 360) + 360) % 360;
        const indexFromRotation =
          (Math.round((360 - norm) / segAngle - 0.5) % n + n) % n;
        setSelectedIndex(indexFromRotation);
        setTimeout(() => setShowResult(true), 350);
      }
    };
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(anim);
  }, [spinning, n, segAngle]);

  const handleUseTopic = useCallback(() => {
    if (selectedIndex !== null) {
      setShowDifficulty(true);
    }
  }, [selectedIndex]);

  const handleConfirmDifficulty = useCallback(
    (level: DifficultyLevel) => {
      if (selectedIndex !== null) {
        onSelect(selectedIndex, level);
        onClose();
      }
    },
    [selectedIndex, onSelect, onClose]
  );

  const handleSpinAgain = useCallback(() => {
    setShowResult(false);
    setShowDifficulty(false);
    setSelectedIndex(null);
    spin();
  }, [spin]);

  if (n <= 1) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Space+Mono:wght@700&display=swap');
        @keyframes resultPop {
          0% { opacity:0; transform:translateY(12px) scale(0.95); }
          60% { transform:translateY(-2px) scale(1.01); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        .roulette-spin-btn {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%,-50%); z-index: 10;
          border: none; outline: none; cursor: pointer;
          width: 60px; height: 60px; border-radius: 50%;
          background: linear-gradient(145deg, #2D2B55, #1a1a2e);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
          box-shadow: 0 3px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .roulette-spin-btn:hover:not(:disabled) { transform: translate(-50%,-50%) scale(1.08); }
        .roulette-spin-btn:active:not(:disabled) { transform: translate(-50%,-50%) scale(0.94); }
        .roulette-spin-btn:disabled { cursor: default; opacity: 0.7; }
        .flapper-arm { transform-origin: 22px 10px; transition: transform 0.05s ease-out; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {/* Popup card */}
        <div className="relative w-full max-w-[380px] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col items-center py-5 px-4" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>

          {showDifficulty && selectedIndex !== null ? (
            <motion.div
              key="difficulty-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <div className="text-center mb-5">
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.3 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground mb-3"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Choose your path
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-[11px] uppercase tracking-widest text-muted-foreground font-mono font-bold mb-1"
                >
                  Your challenge
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm font-bold text-foreground leading-tight px-1"
                >
                  {topics[selectedIndex]}
                </motion.p>
              </div>
              <div className="w-full space-y-3">
                {DIFFICULTY_TIERS.map((tier, i) => {
                  const Icon = tier.icon;
                  return (
                    <motion.button
                      key={tier.id}
                      type="button"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.12 + i * 0.08,
                        duration: 0.35,
                        type: "spring",
                        stiffness: 260,
                        damping: 22,
                      }}
                      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleConfirmDifficulty(tier.id)}
                      className={`w-full relative overflow-hidden rounded-xl border-2 ${tier.border} ${tier.bg} p-4 text-left transition-[box-shadow,transform] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground/30`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = `0 10px 40px ${tier.glow}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "";
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tier.gradient} text-white shadow-md`}
                        >
                          <Icon className="h-6 w-6" strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-[10px] font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r ${tier.gradient}`}
                            >
                              Level {tier.level}
                            </span>
                          </div>
                          <p className="font-bold text-foreground truncate">
                            {tier.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tier.subtitle}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full bg-foreground/10 p-1.5">
                          <ChevronRight className="h-4 w-4 text-foreground" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                type="button"
                onClick={() => setShowDifficulty(false)}
                className="mt-4 w-full py-2.5 px-4 rounded-full text-center text-xs font-bold border-2 border-primary/30 text-primary hover:bg-primary/10 transition-colors"
              >
                ← Back to topic
              </motion.button>
            </motion.div>
          ) : (
            <>
          <div className="text-center mb-3">
            <h2 className="font-black text-xl text-foreground tracking-tight">
              Spin &amp; Discover
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your next topic is one spin away
            </p>
          </div>

          <div className="relative">
            {/* Flapper - scaled down */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-30 scale-75 origin-top">
              <svg className="flapper-arm" width="44" height="62" viewBox="0 0 44 62" style={{ transform: `rotate(${flapAngle}deg)` }}>
              <rect x="14" y="0" width="16" height="14" rx="3" fill="url(#bracketG)" stroke="#aaa" strokeWidth="0.8" />
              <circle cx="22" cy="10" r="5.5" fill="url(#boltG)" stroke="#999" strokeWidth="0.8" />
              <circle cx="22" cy="10" r="2.5" fill="#777" />
              <path d="M19 14 L16 52 Q15 58 22 58 Q29 58 28 52 L25 14" fill="url(#armG)" stroke="#B0B0B8" strokeWidth="1" />
              <path d="M20 16 L18 50 Q17.5 54 22 54 L22 54 Q20 54 20.5 50 L22.5 16 Z" fill="rgba(255,255,255,0.3)" />
              <circle cx="22" cy="56" r="4" fill="url(#tipG)" stroke="#aaa" strokeWidth="0.6" />
              <circle cx="20.5" cy="54.5" r="1.2" fill="rgba(255,255,255,0.5)" />
              <defs>
                <linearGradient id="bracketG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#E8E8EC" /><stop offset="50%" stopColor="#D4D4D8" /><stop offset="100%" stopColor="#B8B8BC" /></linearGradient>
                <radialGradient id="boltG" cx="35%" cy="35%"><stop offset="0%" stopColor="#F0F0F2" /><stop offset="100%" stopColor="#A0A0A8" /></radialGradient>
                <linearGradient id="armG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#D8D8DC" /><stop offset="25%" stopColor="#F0F0F2" /><stop offset="50%" stopColor="#E0E0E4" /><stop offset="75%" stopColor="#D0D0D4" /><stop offset="100%" stopColor="#C0C0C4" /></linearGradient>
                <radialGradient id="tipG" cx="35%" cy="35%"><stop offset="0%" stopColor="#F5F5F7" /><stop offset="100%" stopColor="#B0B0B8" /></radialGradient>
              </defs>
            </svg>
          </div>

          <div
            className="rounded-full transition-shadow duration-300"
            style={{
              transform: `rotate(${rotation}deg)`,
              willChange: "transform",
              boxShadow: spinning ? "0 12px 48px rgba(0,0,0,0.14), 0 0 0 3px rgba(123,47,247,0.08)" : "0 10px 40px rgba(0,0,0,0.1)",
            }}
          >
            <canvas ref={canvasRef} className="block rounded-full" />
          </div>

          <button
            type="button"
            className="roulette-spin-btn"
            onClick={spin}
            disabled={spinning}
          >
            <span className="font-mono font-bold text-sm tracking-[0.2em] text-white z-10 relative">
              {spinning ? "•••" : "SPIN"}
            </span>
          </button>
        </div>

        {/* Result: topic number + name, Spin again, Use this topic */}
        <div className="min-h-[100px] flex flex-col items-center justify-center gap-3 mt-4 w-full px-2">
          {showResult && selectedIndex !== null && (
            <div className="animate-[resultPop_0.55s_cubic-bezier(0.34,1.56,0.64,1)_forwards] text-center w-full">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono font-bold mb-1">
                Topic {selectedIndex + 1} of {n}
              </div>
              <div
                className="text-base font-extrabold text-foreground py-3 px-4 rounded-xl border border-border bg-muted/50 shadow-md relative overflow-hidden"
                style={{
                  borderTopColor: getColor(selectedIndex),
                  borderTopWidth: 3,
                }}
              >
                {topics[selectedIndex]}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSpinAgain}
                  className="rounded-lg gap-1.5 font-bold"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Spin again
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleUseTopic}
                  className="rounded-lg gap-1.5 font-bold bg-foreground hover:bg-foreground/90 text-background"
                >
                  <Check className="w-3.5 h-3.5" /> Use this topic
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground font-medium mt-1">
          {n} topics
        </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
