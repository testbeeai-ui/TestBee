/**
 * Subtopic names from curriculum sometimes include LaTeX (bad for titles and URL slugs).
 * Content APIs still use the exact DB string; these helpers only affect display and routing segments.
 */

import { slugify } from "@/lib/slugs";

/** True when the string looks like it contains LaTeX commands (\frac, \text, …). */
export function subtopicNameHasLatexCommands(name: string): boolean {
  return /\\[a-zA-Z]/.test(String(name ?? ""));
}

/**
 * Plain-language title: text before the first LaTeX command, trimmed.
 * Formulas belong in lesson body, not in navigation labels.
 */
export function humanReadableSubtopicTitle(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");

  const latexStart = s.search(/\\[a-zA-Z]/);
  if (latexStart >= 0) {
    s = s.slice(0, latexStart).trim();
  }

  s = s.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  s = s.replace(/[:;,\s]+$/g, "").trim();

  if (!s) {
    s = String(raw ?? "").trim();
    s = s.replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^{}]*\})?/g, " ");
    s = s.replace(/[{}^_]/g, " ");
    s = s.replace(/\s+/g, " ").trim();
  }

  return s;
}

/**
 * Curriculum strings often use ASCII smash-ups (sintheta, tau) instead of sin θ, τ.
 * Apply before other title prettify rules. URL slugs stay unchanged; this is display-only.
 */
function expandCurriculumFormulaSpellings(s: string): string {
  return s
    .replace(/\bsintheta\b/gi, "sin θ")
    .replace(/\bcostheta\b/gi, "cos θ")
    .replace(/\btantheta\b/gi, "tan θ")
    .replace(/\bcottheta\b/gi, "cot θ")
    .replace(/\bsectheta\b/gi, "sec θ")
    .replace(/\bcsctheta\b/gi, "csc θ")
    .replace(/\btau\b/gi, "τ");
}

/**
 * Display-only: fix smashed words, Greek letter spellings, and light formula typography for nav and headings.
 * Does not change the canonical `subtopicName` used for APIs or DB keys.
 */
export function prettifySubtopicTitle(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");

  s = expandCurriculumFormulaSpellings(s);

  // Fix common compressed curriculum tokens in magnetic-properties titles.
  s = s
    .replace(/\bchi(?:\s*|-)?slightly(?:\s*|-)?negative\b/gi, "chi slightly negative")
    .replace(/\bchi(?:\s*|-)?small(?:\s*|-)?positive\b/gi, "chi small positive")
    .replace(/\bchi(?:\s*|-)?very(?:\s*|-)?large(?:\s*|-)?positive\b/gi, "chi very large positive")
    .replace(/\bmur(?:\s*|-)?slightly\b/gi, "mur slightly");

  // Fix smashed words (AI / math-mode artifacts): ")andx", "axisfromx", "atox ="
  s = s
    .replace(/\)([A-Za-z])/g, ") $1")
    .replace(/axisfromx/gi, "axis from x")
    .replace(/axisfromy/gi, "axis from y")
    .replace(/fromx\s*=/gi, "from x =")
    .replace(/fromy\s*=/gi, "from y =")
    .replace(/\bx\s*=\s*atox\s*=/gi, "x = a to x =")
    .replace(/\by\s*=\s*ctoy\s*=/gi, "y = c to y =")
    .replace(/\|\s*f\s*\(\s*x\s*\)\s*\|\s*dx/gi, "|f(x)| dx");

  s = s
    .replace(/\\times/g, "×")
    .replace(/\bx\s*[- ]*a\s*x(?:is)?\s+from\b/gi, "x-axis from")
    .replace(/\by\s*[- ]*a\s*x(?:is)?\s+from\b/gi, "y-axis from")
    .replace(/\bx\s*axis\b/gi, "x-axis")
    .replace(/\by\s*axis\b/gi, "y-axis")
    .replace(/(\b\d+|\b[a-z]\b)\s*[x×]\s*(\d+\b|\b[a-z]\b)/gi, "$1 × $2")
    .replace(/\bpi\b/gi, "π")
    .replace(/\s*[-−]\s*/g, " - ")
    .replace(/\|\s*a\s*\|\s*\|\s*b\s*\|/gi, "|a| |b|");

  s = s
    .replace(/\(\s*theta\s*\)/gi, "θ")
    .replace(/\btheta\b/gi, "θ")
    .replace(/\bsin\s*θ\b/gi, "sinθ ")
    .replace(/\bn\s*[-_ ]*hat/gi, "n̂ ")
    .replace(/\\hat\s*\{?\s*n\s*\}?/gi, "n̂ ");

  if (/right\s*[- ]*hand/i.test(s) || /hand\s*rule/i.test(s) || /by\s*right/i.test(s) || /byright/i.test(s)) {
    s = s
      .replace(/\bby\s*right\b/gi, "")
      .replace(/byright/gi, "")
      .replace(/\bright\s*[- ]*hand\b/gi, "")
      .replace(/\bhand\s*rule\b/gi, "")
      .replace(/\brule\b/gi, "")
      .replace(/[\(\)\-]/g, "")
      .trim();
    s = `${s} (Right-hand rule)`;
  }

  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\s*=\s*/g, " = ");
  return s;
}

/** Heading line under chapter (Deep Dive breadcrumb, dialogs). */
export function displaySubtopicHeading(raw: string): string {
  const h = humanReadableSubtopicTitle(raw);
  const base = h || String(raw ?? "").trim();
  return prettifySubtopicTitle(base);
}

/** Curriculum line for Ampère’s law (magnetic field line integral); slug stays `b-dl-mu-0i-enclosed-…`. */
const AMPERE_LINE_INTEGRAL_CURRICULUM =
  /^B\.dl\s*=\s*mu_0I_enclosed\s*\(\s*line integral around a closed Amperian loop\s*\)\s*$/i;

/** Slug for Biot–Savart vector-form line in class 12 physics curriculum (URL segment unchanged). */
const BIOT_SAVART_SLUG =
  "db-mu-0-4pi-x-i-dl-x-r-r-2-mu-0-4pi-x-10-7-t-m-a-1";

/** Matches the plain-text curriculum title for Biot–Savart (before LaTeX display). */
const BIOT_SAVART_CURRICULUM =
  /^dB\s*=\s*mu_0\/4pi\s*x\s*I\s*\(\s*dl\s*x\s*r\s*\)\s*\/\s*r\^2\s*\(\s*mu_0\s*=\s*4pi\s*x\s*10\^-7\s*T\s*m\s*A\^-1\s*\)\s*$/i;

function isBiotSavartCurriculumSubtopic(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (slugify(t) === BIOT_SAVART_SLUG) return true;
  return BIOT_SAVART_CURRICULUM.test(t);
}

/** Slug for “Definition of Ampere” (Force between conductors); URL segment unchanged. */
const DEFINITION_OF_AMPERE_SLUG =
  "definition-of-ampere-1-a-produces-f-l-2-x-10-7-n-m-when-d-1-m";

/** Class 12 physics curriculum line (plain); avoid wrapping the whole title in math so words don’t collapse. */
const DEFINITION_OF_AMPERE_CURRICULUM =
  /^Definition\s+of\s+Ampere:\s*1\s*A\s+produces\s+F\s*\/\s*L\s*=\s*2\s*[x×]\s*10\s*\^\s*-\s*7\s*N\s*\/\s*m\s+when\s+d\s*=\s*1\s*m\s*$/i;

function isDefinitionOfAmpereSubtopic(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (slugify(t) === DEFINITION_OF_AMPERE_SLUG) return true;
  return DEFINITION_OF_AMPERE_CURRICULUM.test(t);
}

/** Slug: force between conductors, parallel-wire formula. */
const FORCE_PER_UNIT_LENGTH_PARALLEL_SLUG =
  "force-per-unit-length-between-two-parallel-conductors-f-l-mu-0i-1i-2-2pid";

/** `Force per unit length between two parallel conductors: F/L = mu_0I_1I_2/2pid` */
const FORCE_PER_UNIT_LENGTH_PARALLEL_CURRICULUM =
  /^Force\s+per\s+unit\s+length\s+between\s+two\s+parallel\s+conductors:\s*F\s*\/\s*L\s*=\s*mu_0I_1I_2\s*\/\s*2pid\s*$/i;

function isForcePerUnitParallelConductorsSubtopic(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (slugify(t) === FORCE_PER_UNIT_LENGTH_PARALLEL_SLUG) return true;
  return FORCE_PER_UNIT_LENGTH_PARALLEL_CURRICULUM.test(t);
}

/** Magnetic force — vector and magnitude forms; slug unchanged. */
const FORCE_ON_CURRENT_CARRYING_CONDUCTOR_SLUG =
  "force-on-current-carrying-conductor-f-i-l-x-b-f-bil-sintheta";

const FORCE_ON_CURRENT_CARRYING_CONDUCTOR_CURRICULUM =
  /^Force\s+on\s+current-carrying\s+conductor:\s*F\s*=\s*I\s*\(\s*L\s*[x×]\s*B\s*\)\s*;\s*F\s*=\s*BIL\s+sintheta\s*$/i;

function isForceOnCurrentCarryingConductorSubtopic(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (slugify(t) === FORCE_ON_CURRENT_CARRYING_CONDUCTOR_SLUG) return true;
  return FORCE_ON_CURRENT_CARRYING_CONDUCTOR_CURRICULUM.test(t);
}

/** Charged particle in uniform B — radius and period; slug unchanged. */
const CIRCULAR_MOTION_IN_B_SLUG =
  "circular-motion-in-b-radius-r-mv-qb-time-period-t-2pim-qb-independent-of-v";

const CIRCULAR_MOTION_IN_B_CURRICULUM =
  /^Circular\s+motion\s+in\s+B:\s*radius\s+r\s*=\s*mv\/qB;\s*time\s+period\s+T\s*=\s*2pim\/qB\s*\(\s*independent\s+of\s+v\s*\)\s*$/i;

function isCircularMotionInMagneticFieldBSubtopic(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (slugify(t) === CIRCULAR_MOTION_IN_B_SLUG) return true;
  return CIRCULAR_MOTION_IN_B_CURRICULUM.test(t);
}

/** Torque on current loop — scalar + vector forms; slug unchanged. */
const TORQUE_ON_CURRENT_LOOP_SLUG =
  "torque-on-a-current-loop-tau-nbia-sintheta-vector-form-tau-m-x-b-m-nia";

const TORQUE_ON_CURRENT_LOOP_CURRICULUM =
  /^Torque\s+on\s+a\s+current\s+loop:\s*tau\s*=\s*nBIA\s+sintheta;\s*vector\s+form\s*tau\s*=\s*m\s*[x×]\s*B\s*\(\s*m\s*=\s*nIA\s*\)\s*$/i;

function isTorqueOnCurrentLoopSubtopic(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (slugify(t) === TORQUE_ON_CURRENT_LOOP_SLUG) return true;
  return TORQUE_ON_CURRENT_LOOP_CURRICULUM.test(t);
}

const MOVING_COIL_GALVANOMETER_SUBTOPIC_SLUG =
  "moving-coil-galvanometer-coil-between-pole-pieces-restoring-torque-ktheta-current-sensitivity-i-k-nab";

const MOVING_COIL_GALVANOMETER_SUBTOPIC_CURRICULUM =
  /^Moving\s+coil\s+galvanometer:\s*coil\s+between\s+pole\s+pieces;\s*restoring\s+torque\s+ktheta;\s*current\s+sensitivity\s+I\s*=\s*k\s*\/\s*nAB\s*$/i;

function isMovingCoilGalvanometerSubtopic(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (slugify(t) === MOVING_COIL_GALVANOMETER_SUBTOPIC_SLUG) return true;
  return MOVING_COIL_GALVANOMETER_SUBTOPIC_CURRICULUM.test(t);
}

/**
 * Rich heading for subtopic deep-dive H1: explicit `$…$` chunks so MathText/KaTeX shows μ₀, B, I clearly
 * (avoids plain-text "mu_0nl" confusion). Canonical `subtopicName` and URL slug stay unchanged.
 */
export function subtopicDeepDiveHeadingMarkdown(subtopicName: string): string {
  const raw = String(subtopicName ?? "").trim();
  if (!raw) return "";

  if (isBiotSavartCurriculumSubtopic(raw)) {
    return `$$d\\vec{B} = \\frac{\\mu_0}{4\\pi} \\frac{I(d\\vec{l} \\times \\hat{r})}{r^2}$$`;
  }

  if (isDefinitionOfAmpereSubtopic(raw)) {
    return `Definition of Ampere: 1 A produces $F/L = 2 \\times 10^{-7}$ N/m when $d = 1$ m`;
  }

  if (isForcePerUnitParallelConductorsSubtopic(raw)) {
    return `Force per unit length between two parallel current-carrying conductors and the formula as: $$\\frac{F}{L} = \\frac{\\mu_0 I_1 I_2}{2\\pi d}$$`;
  }

  if (isForceOnCurrentCarryingConductorSubtopic(raw)) {
    // Single display block to save vertical space (one KaTeX block vs stacked lines).
    return `Force on current-carrying conductor: $$\\vec{F} = I(\\vec{L} \\times \\vec{B}),\\quad F = B\\,I\\,L\\,\\sin\\theta$$`;
  }

  if (isCircularMotionInMagneticFieldBSubtopic(raw)) {
    return `Circular motion in a uniform magnetic field $B$: $$r = \\frac{mv}{qB},\\quad T = \\frac{2\\pi m}{qB}\\ \\text{(independent of } v\\text{)}$$`;
  }

  if (isTorqueOnCurrentLoopSubtopic(raw)) {
    return `Torque on a current loop: $$\\tau = n\\,B\\,I\\,A\\,\\sin\\theta,\\quad \\vec{\\tau} = \\vec{m} \\times \\vec{B}\\ \\text{(}m = nIA\\text{)}$$`;
  }

  if (isMovingCoilGalvanometerSubtopic(raw)) {
    return `Moving coil galvanometer: coil between pole pieces; restoring torque $k\\theta$; current sensitivity $I = \\dfrac{k}{n\\,A\\,B}$`;
  }

  const solenoid = raw.match(
    /^Field inside a long solenoid:\s*B\s*=\s*mu_0n[lLiI]\s*\(\s*n\s*=\s*([^)]+)\)\s*$/i,
  );
  if (solenoid) {
    const rest = solenoid[1]!.trim();
    return `Field Inside a Long Solenoid: $B = \\mu_0 n I$ ($n$ = ${rest})`;
  }

  if (AMPERE_LINE_INTEGRAL_CURRICULUM.test(raw)) {
    return `$$\\oint \\vec{B} \\cdot d\\vec{l} = \\mu_0 I_{\\text{enclosed}}$$`;
  }

  return raw;
}

/**
 * String for MathText in sidebar, dialogs, and prev/next: special headings (solenoid, Ampère, …) or prettified plain titles.
 * Uses inline math for Ampère’s-law slug where the deep-dive H1 uses display `$$…$$`.
 */
export function subtopicMathTextLabel(subtopicName: string): string {
  const raw = String(subtopicName ?? "").trim();
  if (!raw) return "";
  if (/^standard\s+areas\b/i.test(raw)) {
    return prettifySubtopicTitle(raw);
  }
  const deep = subtopicDeepDiveHeadingMarkdown(raw);
  if (deep !== raw) {
    if (AMPERE_LINE_INTEGRAL_CURRICULUM.test(raw)) {
      return `$\\oint \\vec{B} \\cdot d\\vec{l} = \\mu_0 I_{\\text{enclosed}}$`;
    }
    if (isBiotSavartCurriculumSubtopic(raw)) {
      return `$d\\vec{B} = \\frac{\\mu_0}{4\\pi} \\frac{I(d\\vec{l} \\times \\hat{r})}{r^2}$`;
    }
    if (isForcePerUnitParallelConductorsSubtopic(raw)) {
      return `Force per unit length between two parallel current-carrying conductors: $\\frac{F}{L} = \\frac{\\mu_0 I_1 I_2}{2\\pi d}$`;
    }
    if (isForceOnCurrentCarryingConductorSubtopic(raw)) {
      return `Force on current-carrying conductor: $\\vec{F} = I(\\vec{L} \\times \\vec{B})$, $F = B\\,I\\,L\\,\\sin\\theta$`;
    }
    if (isCircularMotionInMagneticFieldBSubtopic(raw)) {
      return `Circular motion in a uniform magnetic field $B$: $r = \\frac{mv}{qB}$, $T = \\frac{2\\pi m}{qB}$ (independent of $v$)`;
    }
    if (isTorqueOnCurrentLoopSubtopic(raw)) {
      return `Torque on a current loop: $\\tau = n\\,B\\,I\\,A\\,\\sin\\theta$, $\\vec{\\tau} = \\vec{m} \\times \\vec{B}$ ($m = nIA$)`;
    }
    if (isMovingCoilGalvanometerSubtopic(raw)) {
      return `Moving coil galvanometer: coil between pole pieces; $k\\theta$ (restoring); $I = \\frac{k}{n\\,A\\,B}$ (current sensitivity)`;
    }
    return deep;
  }
  return prettifySubtopicTitle(humanReadableSubtopicTitle(raw));
}

/** Plain one line for `title=` attributes and sentences (no `$…$`). */
export function subtopicNavPreviewPlain(subtopicName: string): string {
  const t = String(subtopicName ?? "").trim();
  if (AMPERE_LINE_INTEGRAL_CURRICULUM.test(t)) {
    return "∮ B·dl = μ₀ I_enclosed";
  }
  if (isBiotSavartCurriculumSubtopic(t)) {
    return "dB⃗ = (μ₀/4π) I(d⃗l×r̂)/r²";
  }
  if (isDefinitionOfAmpereSubtopic(t)) {
    return "Definition of Ampere: 1 A produces F/L = 2×10⁻⁷ N/m when d = 1 m";
  }
  if (isForcePerUnitParallelConductorsSubtopic(t)) {
    return "F/L = μ₀I₁I₂/(2πd) — force per unit length, parallel current-carrying conductors";
  }
  if (isForceOnCurrentCarryingConductorSubtopic(t)) {
    return "F⃗ = I(L⃗×B⃗); F = B · I · L · sin θ — force on current-carrying conductor";
  }
  if (isCircularMotionInMagneticFieldBSubtopic(t)) {
    return "Circular motion in B: r = mv/(qB), T = 2πm/(qB), independent of v";
  }
  if (isTorqueOnCurrentLoopSubtopic(t)) {
    return "τ = nBIA sin θ; τ⃗ = m⃗×B⃗ (m = nIA) — torque on current loop";
  }
  if (isMovingCoilGalvanometerSubtopic(t)) {
    return "Moving coil galvanometer: restoring kθ; current sensitivity I = k/(nAB)";
  }
  return prettifySubtopicTitle(humanReadableSubtopicTitle(t))
    .replace(/\$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * URL segment for a subtopic: short slug when the name was LaTeX-heavy; otherwise same as slugify(name).
 */
export function subtopicSlugForRouting(subtopicName: string): string {
  const full = slugify(subtopicName);
  if (!subtopicNameHasLatexCommands(subtopicName)) {
    return full;
  }
  const short = slugify(humanReadableSubtopicTitle(subtopicName));
  return short.length > 0 ? short : full;
}
