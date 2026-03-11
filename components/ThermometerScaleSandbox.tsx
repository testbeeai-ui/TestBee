"use client";

import { useState, useRef, useEffect } from "react";
import { Gamepad2, Lightbulb, Droplets, Thermometer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const THERM_HEIGHT = 140;

export default function ThermometerScaleSandbox() {
  const [location, setLocation] = useState<"ice" | "boiling">("ice");
  const [mark1, setMark1] = useState<number | null>(null);
  const [mark2, setMark2] = useState<number | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [pendingMark, setPendingMark] = useState<1 | 2 | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput && inputRef.current) inputRef.current.focus();
  }, [showInput]);

  const handleMakeMark = () => {
    if (location === "ice" && mark1 === null) {
      setPendingMark(1);
      setShowInput(true);
      setInputVal("");
    } else if (location === "boiling" && mark2 === null) {
      setPendingMark(2);
      setShowInput(true);
      setInputVal("");
    }
  };

  const submitMark = () => {
    const num = parseFloat(inputVal);
    if (isNaN(num)) return;
    if (pendingMark === 1) {
      setMark1(num);
      setPendingMark(null);
      setShowInput(false);
    } else if (pendingMark === 2) {
      setMark2(num);
      setPendingMark(null);
      setShowInput(false);
    }
  };

  const reset = () => {
    setMark1(null);
    setMark2(null);
    setLocation("ice");
    setShowInput(false);
    setPendingMark(null);
  };

  const low = mark1 !== null && mark2 !== null ? Math.min(mark1, mark2) : 0;
  const high = mark1 !== null && mark2 !== null ? Math.max(mark1, mark2) : 100;
  const range = high - low || 1;
  const numTicks = 11;
  const ticks = Array.from({ length: numTicks }, (_, i) => low + (range * i) / (numTicks - 1));

  return (
    <div className="my-8 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-6 overflow-hidden">
      <div className="mb-4 flex items-center gap-2">
        <Gamepad2 className="h-5 w-5 text-primary shrink-0" />
        <h4 className="font-bold text-foreground">Temperature Scale Sandbox</h4>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Drop a blank thermometer in melting ice, make a mark and type a number (e.g. 0 or 32). Move it to boiling water, make another mark and type another number (e.g. 100 or 212).
        The simulation draws evenly spaced lines between them — showing that Celsius and Fahrenheit are arbitrary human inventions based on the same physical expansion.
      </p>

      <div className="rounded-lg border border-border bg-background p-6">
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-center">
          {/* Ice beaker */}
          <div
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
              location === "ice" ? "border-cyan-500 bg-cyan-500/10" : "border-border bg-muted/30"
            }`}
          >
            <Droplets className="h-8 w-8 text-cyan-600" />
            <span className="text-sm font-semibold">Melting ice</span>
            <div className="relative w-24 h-36 flex justify-center">
              <div className="w-16 h-28 rounded-b-full border-2 border-slate-400 bg-cyan-100/80" />
              {location === "ice" && (
                <div className="absolute -right-2 top-0 flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full border-2 border-slate-600 bg-white" />
                  <div className="w-1.5 bg-slate-600 h-[140px]" />
                </div>
              )}
            </div>
            {location === "ice" && mark1 === null && (
              <span className="text-xs text-muted-foreground">Thermometer here</span>
            )}
            {location === "ice" && mark1 !== null && (
              <span className="text-sm font-bold text-primary">Mark: {mark1}</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("ice")}
              className="w-full max-w-[180px]"
            >
              ← To ice
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("boiling")}
              className="w-full max-w-[180px]"
            >
              To boiling →
            </Button>
            <Button
              onClick={handleMakeMark}
              disabled={
                (location === "ice" && mark1 !== null) ||
                (location === "boiling" && mark2 !== null)
              }
              className="w-full max-w-[180px] bg-primary"
            >
              <Thermometer className="h-4 w-4 mr-1" />
              Make a mark
            </Button>
            {showInput && (
              <div className="flex flex-col gap-1 w-full max-w-[180px]">
                <Input
                  ref={inputRef}
                  type="number"
                  placeholder={location === "ice" ? "e.g. 0 or 32" : "e.g. 100 or 212"}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitMark()}
                  className="h-8 text-sm"
                />
                <Button size="sm" variant="secondary" onClick={submitMark}>
                  Set mark
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>

          {/* Boiling beaker */}
          <div
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
              location === "boiling" ? "border-orange-500 bg-orange-500/10" : "border-border bg-muted/30"
            }`}
          >
            <Droplets className="h-8 w-8 text-orange-600" />
            <span className="text-sm font-semibold">Boiling water</span>
            <div className="relative w-24 h-36 flex justify-center">
              <div className="w-16 h-28 rounded-b-full border-2 border-slate-400 bg-orange-100/80" />
              {location === "boiling" && (
                <div className="absolute -right-2 top-0 flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full border-2 border-slate-600 bg-white" />
                  <div className="w-1.5 bg-slate-600 h-[140px]" />
                </div>
              )}
            </div>
            {location === "boiling" && mark2 === null && (
              <span className="text-xs text-muted-foreground">Thermometer here</span>
            )}
            {location === "boiling" && mark2 !== null && (
              <span className="text-sm font-bold text-primary">Mark: {mark2}</span>
            )}
          </div>
        </div>

        {/* Scale display when both marks are set */}
        {mark1 !== null && mark2 !== null && (
          <div className="mt-6 p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
            <h5 className="text-sm font-bold mb-3">Your scale: evenly spaced lines</h5>
            <div className="flex gap-8 flex-wrap justify-center">
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground mb-1">Thermometer scale</span>
                <svg width="80" height={THERM_HEIGHT + 30} className="border-l-2 border-slate-600">
                  {ticks.map((t, i) => {
                    const y = 20 + THERM_HEIGHT - (THERM_HEIGHT * (t - low)) / range;
                    return (
                      <g key={i}>
                        <line x1={0} y1={y} x2={i === 0 || i === numTicks - 1 ? 20 : 10} y2={y} stroke="#374151" strokeWidth={1} />
                        <text x={24} y={y + 4} fontSize={10} fill="currentColor" className="fill-foreground">
                          {t % 1 === 0 ? t : t.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <p className="text-xs text-muted-foreground mt-2 text-center max-w-[200px]">
                  Same physical expansion, different numbers — Celsius (0,100) and Fahrenheit (32,212) are both valid.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Lightbulb className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">What&apos;s happening:</strong> The liquid expands the same amount in ice and boiling water regardless of what numbers you choose.
          By picking two reference points and spacing the divisions evenly, you define your own temperature scale. Celsius and Fahrenheit are just two arbitrary choices — the physics is identical.
        </div>
      </div>
    </div>
  );
}
