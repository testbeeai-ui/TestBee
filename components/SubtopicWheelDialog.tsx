"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCw, ArrowRight } from "lucide-react";

// Same palette as TopicRoulette
const VIBRANT = [
  "#FF3366", "#FF6B2B", "#FFB800", "#00C9A7",
  "#0088FF", "#7B2FF7", "#FF0099", "#3A86FF",
  "#FF5500", "#8B5CF6", "#06BCC1", "#E63946",
];

const WHEEL_SIZE = 300;

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

function drawWheel(
  canvas: HTMLCanvasElement,
  segmentCount: number,
  highlightIndex: number | null
) {
  const n = segmentCount;
  if (n === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const SIZE = WHEEL_SIZE;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width = SIZE + "px";
  canvas.style.height = SIZE + "px";

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, SIZE, SIZE);

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = SIZE / 2 - 8;
  const wheelR = outerR - 8;
  const segAngleDeg = 360 / n;

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
    const sa = (i * segAngleDeg - 90) * (Math.PI / 180);
    const ea = ((i + 1) * segAngleDeg - 90) * (Math.PI / 180);
    const ma = (sa + ea) / 2;
    const col = VIBRANT[i % VIBRANT.length];
    const isWinner = highlightIndex === i;

    const gx = cx + Math.cos(ma) * wheelR * 0.5;
    const gy = cy + Math.sin(ma) * wheelR * 0.5;
    const grad = ctx.createRadialGradient(cx, cy, 15, gx, gy, wheelR);

    if (isWinner) {
      grad.addColorStop(0, lighten(col, 40));
      grad.addColorStop(0.5, lighten(col, 20));
      grad.addColorStop(1, col);
    } else {
      grad.addColorStop(0, lighten(col, 20));
      grad.addColorStop(0.5, col);
      grad.addColorStop(1, darken(col, 12));
    }

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, wheelR - 1, sa, ea);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    if (isWinner) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, wheelR - 1, sa, ea);
      ctx.closePath();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Segment divider
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sa) * wheelR, cy + Math.sin(sa) * wheelR);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    const tR = wheelR * 0.60;
    const tx = cx + Math.cos(ma) * tR;
    const ty = cy + Math.sin(ma) * tR;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(ma + Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Numbers on slices only; full subtopic title is shown below after the spin.
    const numFs = n <= 6 ? 28 : n <= 10 ? 24 : n <= 14 ? 20 : 16;
    ctx.font = `800 ${numFs}px 'Outfit', system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 3;
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

  // Center hub
  const hr = 32;
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
}

interface SubtopicWheelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtopics: string[];
  onSelect: (subtopicName: string) => void;
}

export default function SubtopicWheelDialog({
  open,
  onOpenChange,
  subtopics,
  onSelect,
}: SubtopicWheelDialogProps) {
  const n = subtopics.length;
  const segAngle = n > 0 ? 360 / n : 360;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wheelDivRef = useRef<HTMLDivElement>(null);
  const curRotRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Ease: 3-phase identical to TopicRoulette (accel → cruise → decel)
  const ease = useCallback((t: number) => {
    if (t < 0.35) return t * 2.5 * t;
    if (t < 0.75) return 0.306 + (1 - 0.306) * 0.82 * ((t - 0.35) / 0.4);
    const p = (t - 0.75) / 0.25;
    return 0.306 + (1 - 0.306) * 0.82 + (1 - 0.306) * 0.18 * (1 - Math.pow(1 - p, 5));
  }, []);

  const startSpin = useCallback(() => {
    if (n < 2) return;

    const target = Math.floor(Math.random() * n);
    // TopicRoulette's exact target angle formula — pointer at 12 o'clock
    const tAngle = 360 - (target * segAngle + segAngle / 2);
    const spins = 6 + Math.random() * 3;
    const total = spins * 360 + tAngle;
    const start = curRotRef.current;
    const end = start + total;
    const dur = 4500 + Math.random() * 2000;
    const t0 = performance.now();

    setSpinning(true);
    setWinnerIndex(null);
    setShowResult(false);

    const tick = (now: number) => {
      const prog = Math.min((now - t0) / dur, 1);
      const angle = start + total * ease(prog);
      curRotRef.current = angle;
      if (wheelDivRef.current) {
        wheelDivRef.current.style.transform = `rotate(${angle}deg)`;
      }
      if (prog < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        curRotRef.current = end;
        if (wheelDivRef.current) {
          wheelDivRef.current.style.transform = `rotate(${end}deg)`;
        }
        setSpinning(false);
        // Derive winner from final angle (same as TopicRoulette)
        const norm = ((end % 360) + 360) % 360;
        const idx = (Math.round((360 - norm) / segAngle - 0.5) % n + n) % n;
        setWinnerIndex(idx);
        setTimeout(() => setShowResult(true), 350);
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(tick);
  }, [n, segAngle, ease]);

  // Re-draw canvas when winner is set (to highlight segment)
  useEffect(() => {
    if (canvasRef.current) {
      drawWheel(canvasRef.current, subtopics.length, winnerIndex);
    }
  }, [winnerIndex, subtopics]);

  // Auto-spin when dialog opens; cleanup when it closes
  useEffect(() => {
    if (!open) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setSpinning(false);
      setWinnerIndex(null);
      setShowResult(false);
      return;
    }
    if (n < 2) return;
    // Small delay for dialog entrance animation
    const id = setTimeout(() => {
      if (canvasRef.current) drawWheel(canvasRef.current, subtopics.length, null);
      startSpin();
    }, 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSpinAgain = useCallback(() => {
    setShowResult(false);
    setWinnerIndex(null);
    if (canvasRef.current) drawWheel(canvasRef.current, subtopics.length, null);
    setTimeout(startSpin, 80);
  }, [subtopics, startSpin]);

  const handleLetsGo = useCallback(() => {
    if (winnerIndex !== null) {
      onSelect(subtopics[winnerIndex]);
    }
  }, [winnerIndex, subtopics, onSelect]);

  const winnerColor =
    winnerIndex !== null ? VIBRANT[winnerIndex % VIBRANT.length] : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&display=swap');
          @keyframes subtopicWheelPop {
            0% { opacity:0; transform:translateY(10px) scale(0.96); }
            60% { transform:translateY(-2px) scale(1.01); }
            100% { opacity:1; transform:translateY(0) scale(1); }
          }
          .wheel-result-pop { animation: subtopicWheelPop 0.38s ease both; }
        `}</style>

        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-lg font-extrabold">
            🎯 Spin for a Subtopic
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {spinning
              ? "Spinning…"
              : showResult && winnerIndex !== null
              ? `Landed on: ${subtopics[winnerIndex]}`
              : "Get ready…"}
          </DialogDescription>
        </DialogHeader>

        {/* Wheel area */}
        <div className="relative flex items-center justify-center px-4 py-4">
          {/* Pointer — fixed at 12 o'clock, never rotates */}
          <div
            className="absolute z-20"
            style={{
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
              <polygon
                points="11,24 2,3 20,3"
                fill="#e11d48"
                stroke="#fff"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="11" cy="3.5" r="2.5" fill="#9f1239" />
            </svg>
          </div>

          {/* Rotating wheel wrapper — we mutate style.transform directly */}
          <div
            ref={wheelDivRef}
            style={{
              width: WHEEL_SIZE,
              height: WHEEL_SIZE,
              willChange: "transform",
            }}
          >
            <canvas ref={canvasRef} style={{ display: "block" }} />
          </div>
        </div>

        {/* Result + actions */}
        <div className="px-5 pb-5 min-h-[96px] flex flex-col items-center justify-center gap-3">
          {spinning && (
            <p className="text-sm font-semibold text-muted-foreground animate-pulse">
              Spinning…
            </p>
          )}

          {!spinning && showResult && winnerIndex !== null && (
            <div className="wheel-result-pop w-full space-y-3">
              <div
                className="rounded-xl border-2 bg-muted/40 px-4 py-3 text-center text-base font-bold text-foreground shadow-sm"
                style={{ borderColor: winnerColor }}
              >
                {subtopics[winnerIndex]}
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSpinAgain}
                  className="gap-1.5 rounded-lg font-bold"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Spin Again
                </Button>
                <Button
                  size="sm"
                  onClick={handleLetsGo}
                  className="gap-1.5 rounded-lg font-bold"
                >
                  Let&apos;s Go!
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {!spinning && !showResult && winnerIndex === null && (
            <p className="text-xs text-muted-foreground">
              {n < 2 ? "Not enough subtopics to spin." : "Get ready…"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
