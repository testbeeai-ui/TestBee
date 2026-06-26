import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Atom,
  Calculator,
  FlaskConical,
  Layers,
  Lightbulb,
} from "lucide-react";
import type { Subject } from "@/types";

/** EduBlast dark palette — aligned with profpi_chatbot.html */
export const PROF_PI_CHAT = {
  bg: "#0E1117",
  surface1: "#161B25",
  surface2: "#1C2333",
  surface3: "#222A3A",
  border1: "#2A3347",
  border2: "#334060",
  text1: "#E8EAF0",
  text2: "#9BA3B8",
  text3: "#5C6480",
  purple: "#7F77DD",
  purpleDark: "#534AB7",
  purpleBg: "#171425",
  purpleLight: "#AFA9EC",
  teal: "#1D9E75",
  tealBg: "#0A2A20",
  tealLight: "#9FE1CB",
  amber: "#EF9F27",
  blue: "#378ADD",
  headerGradient: "linear-gradient(135deg, #2A2060, #3D35A0)",
  orbGradient: "linear-gradient(135deg, #534AB7, #7F77DD)",
  sendGradient: "linear-gradient(135deg, #534AB7, #7F77DD)",
} as const;

export const SUBJECT_CHIP_ICON_COLOR: Record<Subject, string> = {
  chemistry: PROF_PI_CHAT.teal,
  physics: PROF_PI_CHAT.blue,
  math: PROF_PI_CHAT.amber,
};

export const SUBJECT_BREADCRUMB_LABEL: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Math",
};

/** Preset chip icons by index (matches getPresetQuestions order) */
export const PRESET_CHIP_ICON_BY_INDEX: LucideIcon[] = [
  FlaskConical, // What is …?
  Atom, // How does … work?
  Lightbulb, // Real-life example
  Calculator, // Key formulas
  AlertTriangle, // Common mistakes
  Layers, // Memory trick (if extended)
];

export function getPresetChipIcon(index: number): LucideIcon {
  return PRESET_CHIP_ICON_BY_INDEX[index] ?? Layers;
}

export const SUBJECT_META: Record<
  Subject,
  { label: string; emoji: string; accentColor: string; lightBg: string }
> = {
  physics: {
    label: "Physics Bot",
    emoji: "⚡",
    accentColor: PROF_PI_CHAT.blue,
    lightBg: "#eff6ff",
  },
  chemistry: {
    label: "Chemistry Bot",
    emoji: "🧪",
    accentColor: PROF_PI_CHAT.teal,
    lightBg: "#f5f3ff",
  },
  math: {
    label: "Math Bot",
    emoji: "📐",
    accentColor: PROF_PI_CHAT.amber,
    lightBg: "#fff7ed",
  },
};
