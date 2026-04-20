"use client";

import type { ReactNode } from "react";

export type NtaSkin = "light" | "dark";

interface NtaMockTokensProps {
  skin: NtaSkin;
  children: ReactNode;
  className?: string;
}

/** Scoped design tokens for NTA-style mock UI (light + dark). */
export function NtaMockTokens({ skin, children, className }: NtaMockTokensProps) {
  return (
    <div
      data-nta-theme={skin}
      className={className}
      style={
        skin === "light"
          ? ({
              ["--nta-bg" as string]: "#ffffff",
              ["--nta-surface" as string]: "#f5f5f5",
              ["--nta-bar" as string]: "#e8e8e8",
              ["--nta-text" as string]: "#1a1a1a",
              ["--nta-muted" as string]: "#5a5a5a",
              ["--nta-border" as string]: "#cccccc",
              ["--nta-title-blue" as string]: "#1a5276",
              ["--nta-green" as string]: "#5cb85c",
              ["--nta-green-hover" as string]: "#4cae4c",
              ["--nta-orange" as string]: "#f0ad4e",
              ["--nta-blue" as string]: "#337ab7",
              ["--nta-blue-hover" as string]: "#286090",
              ["--nta-red" as string]: "#d9534f",
              ["--nta-timer-bg" as string]: "#5bc0de",
              ["--nta-timer-text" as string]: "#ffffff",
              ["--nta-legend-purple" as string]: "#6f42c1",
              ["--nta-pattern" as string]: "#f0f0f0",
              ["--nta-footer" as string]: "#1a1a2e",
              ["--nta-candidate-accent" as string]: "#c45c26",
              ["--nta-palette-unvisited-fill" as string]: "#eceef2",
              ["--nta-palette-unvisited-fill-top" as string]: "#fafbff",
              ["--nta-palette-unvisited-fill-deep" as string]: "#d8dee9",
              ["--nta-palette-unvisited-stroke" as string]: "#9aa5b8",
              ["--nta-palette-unvisited-number" as string]: "#1a2433",
            } as React.CSSProperties)
          : ({
              ["--nta-bg" as string]: "#0f1114",
              ["--nta-surface" as string]: "#161a20",
              ["--nta-bar" as string]: "#1e242d",
              ["--nta-text" as string]: "#f0f2f5",
              ["--nta-muted" as string]: "#9aa3af",
              ["--nta-border" as string]: "#2a313c",
              ["--nta-title-blue" as string]: "#7eb8d8",
              ["--nta-green" as string]: "#5cb85c",
              ["--nta-green-hover" as string]: "#6ccd6c",
              ["--nta-orange" as string]: "#f0ad4e",
              ["--nta-blue" as string]: "#4a90c2",
              ["--nta-blue-hover" as string]: "#5aa0d2",
              ["--nta-red" as string]: "#e85d5a",
              ["--nta-timer-bg" as string]: "#238fa8",
              ["--nta-timer-text" as string]: "#ffffff",
              ["--nta-legend-purple" as string]: "#a78bfa",
              ["--nta-pattern" as string]: "#1a1f26",
              ["--nta-footer" as string]: "#0a0c10",
              ["--nta-candidate-accent" as string]: "#e8a882",
              ["--nta-palette-unvisited-fill" as string]: "#eceef2",
              ["--nta-palette-unvisited-fill-top" as string]: "#f7f8fc",
              ["--nta-palette-unvisited-fill-deep" as string]: "#d4dae6",
              ["--nta-palette-unvisited-stroke" as string]: "#8b95a8",
              ["--nta-palette-unvisited-number" as string]: "#0f1114",
            } as React.CSSProperties)
      }
    >
      {children}
    </div>
  );
}
