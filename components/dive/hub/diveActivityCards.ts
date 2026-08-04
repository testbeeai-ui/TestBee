import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import {
  numeralsRdmTipLines,
  quizRdmTipLines,
} from "@/lib/rdm/subtopicUnitRdmCopy";
import type { DiveActivityId } from "../diveTypes";
import styles from "../styles";

export type DiveActivityCardRdmTip = {
  title: string;
  lines: string[];
};

export type DiveActivityCardDef = {
  id: DiveActivityId;
  title: string;
  tag: string;
  body: string;
  icon: string;
  iconClass: string;
  linkClass: string;
  cta: string;
  /** Hover-only i-button tip (Quiz / Numerals). */
  rdmTip?: DiveActivityCardRdmTip;
};

export function buildDiveActivityCards(): DiveActivityCardDef[] {
  return [
    {
      id: "details",
      title: "Details",
      tag: "Overview",
      body: "Definition, scope of the sub-topic, why it matters, and where it sits within the chapter's flow.",
      icon: "📄",
      iconClass: styles.iconDetails,
      linkClass: styles.linkDetails,
      cta: "Open →",
    },
    {
      id: "concepts",
      title: "Concepts",
      tag: "Core",
      body: "Key laws, derivations and relationships explained step-by-step with diagrams.",
      icon: "💡",
      iconClass: styles.iconConcepts,
      linkClass: styles.linkConcepts,
      cta: "Open →",
    },
    {
      id: "instacue",
      title: "InstaCue",
      tag: "Quick recall",
      body: "Flip-card style memory cues — formula, mnemonic, trick, all in one glance.",
      icon: "⚡",
      iconClass: styles.iconInstacue,
      linkClass: styles.linkInstacue,
      cta: "Flip cards →",
    },
    {
      id: "quiz",
      title: "Quiz",
      tag: "Practice",
      body: "Auto-generated MCQs calibrated to your current mastery level, with instant feedback.",
      icon: "📝",
      iconClass: styles.iconQuiz,
      linkClass: styles.linkQuiz,
      cta: "Start →",
      rdmTip: {
        title: "Quiz RDM",
        lines: quizRdmTipLines(
          DEFAULT_RDM_CONFIG.subtopic_quiz_set_rdm,
          DEFAULT_RDM_CONFIG.subtopic_quiz_advanced_rdm
        ),
      },
    },
    {
      id: "numerals",
      title: "Numerals",
      tag: "Problem solving",
      body: "Worked numerical problems from easy to JEE-Advanced difficulty, with step marks shown.",
      icon: "🔢",
      iconClass: styles.iconNumerals,
      linkClass: styles.linkNumerals,
      cta: "Solve →",
      rdmTip: {
        title: "Numerals RDM",
        lines: numeralsRdmTipLines(
          DEFAULT_RDM_CONFIG.subtopic_numerals_formula_rdm,
          DEFAULT_RDM_CONFIG.subtopic_numerals_pack_rdm
        ),
      },
    },
    {
      id: "outcomes",
      title: "Learning Outcomes",
      tag: "Self-check",
      body: "A short MCQ check — no AI shortcuts here — to see where you truly stand, plus a Knowledge Score by concept.",
      icon: "🎯",
      iconClass: styles.iconOutcomes,
      linkClass: styles.linkOutcomes,
      cta: "Check my level →",
    },
    {
      id: "references",
      title: "References",
      tag: "Media",
      body: "Curated videos and reading links for this exact sub-topic.",
      icon: "🔗",
      iconClass: styles.iconRefs,
      linkClass: styles.linkRefs,
      cta: "Open →",
    },
    {
      id: "classes",
      title: "Classes",
      tag: "Live / recorded",
      body: "Recorded and upcoming live classes from EduBlast mentors covering this sub-topic.",
      icon: "🎥",
      iconClass: styles.iconClasses,
      linkClass: styles.linkClasses,
      cta: "View →",
    },
  ];
}
