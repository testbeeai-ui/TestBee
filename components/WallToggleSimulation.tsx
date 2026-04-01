"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Gamepad2, RefreshCw, Lightbulb } from "lucide-react";

const INITIAL_HOT = 100;
const INITIAL_COLD = 20;
const EQUILIBRIUM_RATE = 0.12;
const MAX_POINTS = 80;

export default function WallToggleSimulation() {
  const [wallType, setWallType] = useState<"diathermic" | "adiabatic">("diathermic");
  const [state, setState] = useState({
    hot: INITIAL_HOT,
    cold: INITIAL_COLD,
    history: [{ t: 0, hot: INITIAL_HOT, cold: INITIAL_COLD }] as { t: number; hot: number; cold: number }[],
  });
  const wallRef = useRef(wallType);
  useEffect(() => {
    wallRef.current = wallType;
  }, [wallType]);

  const reset = useCallback(() => {
    setState({
      hot: INITIAL_HOT,
      cold: INITIAL_COLD,
      history: [{ t: 0, hot: INITIAL_HOT, cold: INITIAL_COLD }],
    });
  }, []);

  useEffect(() => {
    let t = 0;
    const interval = setInterval(() => {
      t += 1;
      const diathermic = wallRef.current === "diathermic";
      setState((s) => {
        let newHot = s.hot;
        let newCold = s.cold;
        if (diathermic) {
          const mid = (s.hot + s.cold) / 2;
          newHot = s.hot + (mid - s.hot) * EQUILIBRIUM_RATE;
          newCold = s.cold + (mid - s.cold) * EQUILIBRIUM_RATE;
        }
        const pt = { t, hot: newHot, cold: newCold };
        const nextHistory = [...s.history.slice(-MAX_POINTS - 1), pt].slice(-MAX_POINTS);
        return { hot: newHot, cold: newCold, history: nextHistory };
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const { hot: hotTemp, cold: coldTemp, history } = state;

  const hotPercent = Math.min(100, Math.max(0, (hotTemp / 100) * 100));
  const coldPercent = Math.min(100, Math.max(0, (coldTemp / 100) * 100));

  const maxT = Math.max(...history.map((p) => p.t), 1);
  const allTemps = history.flatMap((p) => [p.hot, p.cold]);
  const minTemp = Math.min(0, ...allTemps);
  const maxTemp = Math.max(110, ...allTemps);
  const tempRange = maxTemp - minTemp || 1;

  return (
    <div className="my-8 rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Gamepad2 className="h-5 w-5 text-primary" />
        <h4 className="font-bold text-foreground">The &quot;Wall Toggle&quot; Game</h4>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        A hot block and cold box share a wall. Toggle the wall type: <strong className="text-foreground">Diathermic</strong> → temperatures move
        toward a balance point. <strong className="text-foreground">Adiabatic</strong> → the graph stays flat (insulation works).
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-border bg-background p-4 h-full">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex-1 text-center">
                <span className="text-xs font-medium text-muted-foreground block">Hot block</span>
                <span className="text-lg font-bold text-orange-600">{Math.round(hotTemp)}°C</span>
              </div>
              <button
                type="button"
                onClick={() => setWallType((w) => (w === "diathermic" ? "adiabatic" : "diathermic"))}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  wallType === "diathermic" ? "bg-blue-500 text-white shadow" : "bg-slate-600 text-white"
                }`}
              >
                {wallType === "diathermic" ? "Diathermic" : "Adiabatic"}
              </button>
              <div className="flex-1 text-center">
                <span className="text-xs font-medium text-muted-foreground block">Cold box</span>
                <span className="text-lg font-bold text-cyan-600">{Math.round(coldTemp)}°C</span>
              </div>
            </div>
            <div className="flex gap-1 h-16 rounded-lg overflow-hidden border border-border">
              <div
                className="flex-1 flex items-center justify-center transition-colors duration-300"
                style={{ backgroundColor: `rgb(255 ${Math.round(255 - hotPercent * 1.5)} 100)` }}
              />
              <div
                className={`w-2 shrink-0 ${wallType === "diathermic" ? "bg-blue-400" : "bg-slate-500"}`}
                title={wallType === "diathermic" ? "Heat flows through" : "No heat flow"}
              />
              <div
                className="flex-1 flex items-center justify-center transition-colors duration-300"
                style={{ backgroundColor: `rgb(100 ${Math.round(150 + coldPercent)} 255)` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-border bg-background p-4 h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Temperature vs time</span>
              <button type="button" onClick={reset} className="text-xs text-primary hover:underline flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="h-28 relative">
              <svg viewBox={`0 0 ${maxT} 100`} className="w-full h-full" preserveAspectRatio="none">
                {history.length >= 2 && (
                  <>
                    <polyline
                      fill="none"
                      stroke="rgb(234 88 12)"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      points={history.map((p) => `${p.t} ${100 - ((p.hot - minTemp) / tempRange) * 90}`).join(" ")}
                    />
                    <polyline
                      fill="none"
                      stroke="rgb(6 182 212)"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      points={history.map((p) => `${p.t} ${100 - ((p.cold - minTemp) / tempRange) * 90}`).join(" ")}
                    />
                  </>
                )}
              </svg>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-1 rounded bg-orange-500" /> Hot
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-1 rounded bg-cyan-500" /> Cold
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">What&apos;s happening:</strong>{" "}
          {wallType === "diathermic" ? (
            <>
              Heat flows from the hot block into the cold box. The <span className="text-orange-600 font-medium">orange line (hot)</span> drops and
              the <span className="text-cyan-600 font-medium">blue line (cold)</span> rises. When they meet, that&apos;s{" "}
              <strong className="text-foreground">thermal equilibrium</strong> — both reach the same temperature and heat stops flowing.
            </>
          ) : (
            <>
              The adiabatic wall blocks all heat. Both temperatures stay flat — no heat can cross. That&apos;s why the lines don&apos;t move.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
