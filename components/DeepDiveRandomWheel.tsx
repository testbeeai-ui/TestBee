"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Layers, Play, Coffee, Timer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeepDiveRandomWheelProps {
  sections: { title: string }[];
  buildDeepDiveHref: (sectionIndex: number) => string;
  levelLabel: string;
}

const SPINS_BEFORE_BREAK = 3;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
const SPIN_COUNT_KEY = "edublast-random-deepdive-spin-count";

function getStoredSpinCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = sessionStorage.getItem(SPIN_COUNT_KEY);
    return v != null ? Math.max(0, parseInt(v, 10)) : 0;
  } catch {
    return 0;
  }
}

function setStoredSpinCount(n: number): void {
  try {
    sessionStorage.setItem(SPIN_COUNT_KEY, String(n));
  } catch {
    // ignore
  }
}

const COLORS = [
  "hsl(220, 70%, 90%)",
  "hsl(160, 60%, 88%)",
  "hsl(45, 80%, 88%)",
  "hsl(340, 65%, 90%)",
  "hsl(270, 60%, 90%)",
  "hsl(180, 60%, 88%)",
];

export default function DeepDiveRandomWheel({
  sections,
  buildDeepDiveHref,
  levelLabel,
}: DeepDiveRandomWheelProps) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [timerDialogOpen, setTimerDialogOpen] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(5 * 60); // 5 minutes
  const spinCountRef = useRef(0);
  const curRot = useRef(0);

  // Restore spin count from session so it survives navigation (spin → deep dive → back)
  useEffect(() => {
    spinCountRef.current = getStoredSpinCount();
  }, []);

  // 5-minute break timer countdown
  useEffect(() => {
    if (!timerDialogOpen) return;
    setTimerSeconds(5 * 60);
    const id = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerDialogOpen]);

  const n = Math.max(1, sections.length);
  const segAngle = (2 * Math.PI) / n;

  const performSpin = useCallback(() => {
    if (spinning || n === 0) return;
    setSpinning(true);

    const target = Math.floor(Math.random() * n);
    const spins = 4 + Math.random() * 3;
    const totalAngle = spins * 2 * Math.PI + (n - target) * segAngle - segAngle / 2;
    const dur = 2200;
    const start = curRot.current;
    const t0 = performance.now();

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const anim = (now: number) => {
      const prog = Math.min((now - t0) / dur, 1);
      const e = easeOut(prog);
      const c = start + totalAngle * e;
      curRot.current = c;
      setRotation(c);
      if (prog < 1) {
        requestAnimationFrame(anim);
      } else {
        setSpinning(false);
        router.push(buildDeepDiveHref(target));
      }
    };
    requestAnimationFrame(anim);
  }, [spinning, n, segAngle, buildDeepDiveHref, router]);

  const spin = useCallback(() => {
    if (spinning || n === 0) return;
    spinCountRef.current = getStoredSpinCount() + 1;
    setStoredSpinCount(spinCountRef.current);
    if (spinCountRef.current >= SPINS_BEFORE_BREAK) {
      spinCountRef.current = 0;
      setStoredSpinCount(0);
      setBreakDialogOpen(true);
      return;
    }
    performSpin();
  }, [spinning, n, performSpin]);

  const handleTakeBreak = useCallback(() => {
    setBreakDialogOpen(false);
    setTimerDialogOpen(true);
  }, []);

  const handleKeepGoing = useCallback(() => {
    setBreakDialogOpen(false);
    performSpin();
  }, [performSpin]);

  if (n === 0) {
    return (
      <div className="edu-card p-5 rounded-2xl border-2 border-primary/20">
        <h4 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Random Deep Dive
        </h4>
        <p className="text-xs text-muted-foreground">
          No sections to explore yet. Add content with subtopics to enable the wheel.
        </p>
      </div>
    );
  }

  return (
    <div className="edu-card p-5 rounded-2xl border-2 border-primary/20">
      <h4 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        Random Deep Dive
      </h4>
      <p className="text-xs text-muted-foreground mb-4">
        Want to explore a subtopic in depth? Spin the wheel to land on a random section and dive deep. Current level: <strong className="text-foreground">{levelLabel}</strong>.
      </p>

      {/* Wheel with segments */}
      <div className="relative flex flex-col items-center gap-3 my-2">
        <div
          role="button"
          tabIndex={spinning ? -1 : 0}
          onClick={spin}
          onKeyDown={(e) => e.key === "Enter" && !spinning && spin()}
          className={`cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full ${spinning ? "pointer-events-none opacity-70" : ""}`}
          aria-label="Spin roulette wheel"
        >
          <svg
            viewBox="0 0 100 100"
            className="w-28 h-28"
            style={{
              transform: `rotate(${rotation * (180 / Math.PI)}deg)`,
              transition: "none",
            }}
          >
            <g>
              {sections.map((_, i) => {
                const a0 = -Math.PI / 2 + i * segAngle;
                const a1 = -Math.PI / 2 + (i + 1) * segAngle;
                const x0 = 50 + 45 * Math.cos(a0);
                const y0 = 50 - 45 * Math.sin(a0);
                const x1 = 50 + 45 * Math.cos(a1);
                const y1 = 50 - 45 * Math.sin(a1);
                const midAngle = (a0 + a1) / 2;
                const numRadius = 32;
                const numX = 50 + numRadius * Math.cos(midAngle);
                const numY = 50 - numRadius * Math.sin(midAngle);
                const textRotate = (midAngle * 180) / Math.PI;
                return (
                  <g key={i}>
                    <path
                      d={`M 50 50 L ${x0} ${y0} A 45 45 0 0 1 ${x1} ${y1} Z`}
                      fill={COLORS[i % COLORS.length]}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <text
                      x={numX}
                      y={numY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="14"
                      fontWeight="bold"
                      fill="hsl(220, 25%, 30%)"
                      transform={`rotate(${textRotate}, ${numX}, ${numY})`}
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
              <circle cx="50" cy="50" r="18" fill="hsl(var(--primary))" stroke="white" strokeWidth="2" />
              <text x="50" y="54" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                SPIN
              </text>
            </g>
          </svg>
        </div>

        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 border-2 border-primary/30"
        >
          <Play className="w-4 h-4" fill="currentColor" />
          Start
        </button>

        <p className="text-[10px] text-muted-foreground text-center">
          {n} section{sections.length !== 1 ? "s" : ""} • Roulette
        </p>
      </div>

      <Dialog open={breakDialogOpen} onOpenChange={setBreakDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coffee className="w-5 h-5 text-amber-600" />
              Time for a break?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-muted-foreground">
              You&apos;ve been exploring a lot! Studies show that taking short breaks helps your brain absorb what you&apos;ve learned. Would you like to take a 5‑minute break?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={handleKeepGoing}
              >
                Keep going
              </Button>
              <Button
                onClick={handleTakeBreak}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Yes, take a 5‑min break
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={timerDialogOpen} onOpenChange={setTimerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-amber-600" />
              5‑minute break
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <p className="text-muted-foreground text-center">
              Step away, stretch, or grab some water. Come back when you&apos;re ready!
            </p>
            <div className="flex justify-center">
              <div className="text-4xl font-mono font-bold tabular-nums text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-xl px-8 py-6 border-2 border-amber-200 dark:border-amber-800">
                {formatTime(timerSeconds)}
              </div>
            </div>
            {timerSeconds === 0 && (
              <p className="text-center text-sm text-green-600 dark:text-green-400 font-medium">
                Break complete! Ready to dive back in?
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => setTimerDialogOpen(false)}
            >
              {timerSeconds === 0 ? "Done" : "I'm back — close timer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
