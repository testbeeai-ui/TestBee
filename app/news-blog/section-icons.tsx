import {
  AlarmClock,
  Award,
  BookOpen,
  Brain,
  CalendarDays,
  FileText,
  Lightbulb,
  Megaphone,
} from "lucide-react";

import type { SectionId } from "./types";

/** Includes legacy `bmind` for icons on raw DB rows before normalize. */
export function getSectionIcon(section: SectionId | "" | "bmind") {
  switch (section) {
    case "nbuzz":
      return <Megaphone className="h-4 w-4" />;
    case "ndates":
      return <CalendarDays className="h-4 w-4" />;
    case "nresults":
      return <Award className="h-4 w-4" />;
    case "npapers":
      return <FileText className="h-4 w-4" />;
    case "btoppers":
      return <Award className="h-4 w-4" />;
    case "btips":
      return <Lightbulb className="h-4 w-4" />;
    case "bmattitude":
    case "bmind":
      return <Brain className="h-4 w-4" />;
    case "blast":
      return <AlarmClock className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
}
