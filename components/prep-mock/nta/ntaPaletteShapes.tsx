"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * NTA-style legend + question-palette glyphs (tag / bookmark / circle / composite).
 * Same shapes in the legend and in the grid so status semantics stay visually aligned.
 */

export type NtaPaletteKind = "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked";

export function getNtaPaletteKind(visited: boolean, answered: boolean, marked: boolean): NtaPaletteKind {
  if (!visited) return "not_visited";
  if (answered && marked) return "answered_marked";
  if (marked) return "marked";
  if (answered) return "answered";
  return "not_answered";
}

const VB = 24;

/** Canonical palette glyph; `size` is CSS px width & height (ignored when `fill` is true). */
export function NtaPaletteShapeSvg({
  kind,
  size = 22,
  className,
  fill,
  tile,
}: {
  kind: NtaPaletteKind;
  size?: number;
  className?: string;
  /** Stretch to parent box — parent should set explicit width/height (responsive tiles). */
  fill?: boolean;
  /** Question palette: larger artwork + seat-map style (gradient tile, soft elevation on colors). */
  tile?: boolean;
}) {
  const rid = useId().replace(/:/g, "");
  const strokeMuted = "rgba(0,0,0,0.22)";
  const strokeDark = "rgba(0,0,0,0.35)";

  const defs = tile ? (
    <defs>
      <linearGradient id={`${rid}-nv`} x1="0" y1="0" x2="0" y2={VB} gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="var(--nta-palette-unvisited-fill-top, var(--nta-palette-unvisited-fill))" />
        <stop offset="100%" stopColor="var(--nta-palette-unvisited-fill-deep, var(--nta-palette-unvisited-stroke))" />
      </linearGradient>
      <filter id={`${rid}-elev`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1" stdDeviation="0.75" floodColor="#000000" floodOpacity="0.2" />
      </filter>
    </defs>
  ) : null;

  const inner = (() => {
    switch (kind) {
      case "not_visited":
        if (tile) {
          return (
            <rect
              x={3.25}
              y={4.25}
              width={17.5}
              height={15.5}
              rx={4}
              ry={4}
              fill={`url(#${rid}-nv)`}
              stroke="var(--nta-palette-unvisited-stroke)"
              strokeWidth={1.45}
            />
          );
        }
        return (
          <rect
            x={4}
            y={5}
            width={16}
            height={14}
            rx={3.5}
            ry={3.5}
            fill="var(--nta-palette-unvisited-fill)"
            stroke="var(--nta-palette-unvisited-stroke)"
            strokeWidth={1.25}
          />
        );
      case "not_answered": {
        const poly = (
          <polygon
            points={`4,5 17,5 21,${VB / 2} 17,19 4,19`}
            fill="var(--nta-red)"
            stroke={strokeDark}
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
        );
        return tile ? <g filter={`url(#${rid}-elev)`}>{poly}</g> : poly;
      }
      case "answered": {
        const poly = (
          <polygon
            points={`4,8 12,3.5 20,8 20,20 4,20`}
            fill="var(--nta-green)"
            stroke={strokeMuted}
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
        );
        return tile ? <g filter={`url(#${rid}-elev)`}>{poly}</g> : poly;
      }
      case "marked": {
        const c = (
          <circle cx={12} cy={12} r={8.2} fill="var(--nta-legend-purple)" stroke="#4b2d8a" strokeWidth={0.6} />
        );
        return tile ? <g filter={`url(#${rid}-elev)`}>{c}</g> : c;
      }
      case "answered_marked": {
        const dual = (
          <g>
            <circle cx={11.5} cy={11.5} r={8} fill="var(--nta-legend-purple)" stroke="#4b2d8a" strokeWidth={0.55} />
            <circle cx={17.5} cy={17.5} r={4.2} fill="var(--nta-green)" stroke="#2d6a2d" strokeWidth={0.45} />
          </g>
        );
        return tile ? <g filter={`url(#${rid}-elev)`}>{dual}</g> : dual;
      }
      default:
        return null;
    }
  })();

  const body =
    tile ? (
      <g transform={`translate(${VB / 2} ${VB / 2}) scale(1.18) translate(${-VB / 2} ${-VB / 2})`}>{inner}</g>
    ) : (
      inner
    );

  return (
    <svg
      className={cn(fill ? "block h-full w-full max-h-full max-w-full" : "block shrink-0", className)}
      width={fill ? "100%" : size}
      height={fill ? "100%" : size}
      viewBox={`0 0 ${VB} ${VB}`}
      aria-hidden={true}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {defs}
      {body}
    </svg>
  );
}

export function ShapeNotVisited({ className }: { className?: string }) {
  return <NtaPaletteShapeSvg kind="not_visited" size={20} className={className} />;
}

export function ShapeNotAnswered({ className }: { className?: string }) {
  return <NtaPaletteShapeSvg kind="not_answered" size={20} className={className} />;
}

export function ShapeAnswered({ className }: { className?: string }) {
  return <NtaPaletteShapeSvg kind="answered" size={20} className={className} />;
}

export function ShapeMarkedOnly({ className }: { className?: string }) {
  return <NtaPaletteShapeSvg kind="marked" size={20} className={className} />;
}

export function ShapeAnsweredMarked({ className }: { className?: string }) {
  return <NtaPaletteShapeSvg kind="answered_marked" size={22} className={className} />;
}
