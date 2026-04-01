import type { LucideIcon } from "lucide-react";
import { Atom, BookOpen, Dna, FlaskConical } from "lucide-react";
import type { Subject } from "@/types";

/** Lucide icons per syllabus subject — keep imports in this file only to avoid `ReferenceError: Atom is not defined`. */
export const SUBJECT_FEED_ICON: Record<Subject, LucideIcon> = {
  physics: Atom,
  chemistry: FlaskConical,
  math: BookOpen,
  biology: Dna,
};

export const SUBJECT_FEED_ICON_CLASS: Record<Subject, string> = {
  physics: "text-blue-600",
  chemistry: "text-purple-600",
  math: "text-orange-600",
  biology: "text-green-600",
};
