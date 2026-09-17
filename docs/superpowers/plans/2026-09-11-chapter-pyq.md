# Chapter PYQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Chapter PYQ format and flow: a LearnHub button, a JEE Main PCM chapter list, and an empty practice shell — no questions yet.

**Architecture:** A static catalog module (`lib/chapter-pyq/catalog.ts`) is the source of truth for slugs and titles. Two App Router pages under `/chapter-pyq` render the list and the practice empty state. The Prep LearnHub row keeps navigating to `/explore-1`; a nested button `stopPropagation`s to `/chapter-pyq`. Middleware treats the new path as student-only, like Learn Hub.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, existing `AppLayout` + Tailwind, `slugify` from `lib/slugs.ts`.

## Global Constraints

- Web only. Do not touch EduDeca / EduBite.
- Exam is **JEE Main** only. Do not mix CBSE `MCQ_CHAPTERS` or `curriculum_chapters`.
- Mathematics must include all **31** titles from the spec (the PDF list).
- Practice page must show **Questions coming soon** — no dummy MCQs, timer, or NTA palette.
- LearnHub card click must still go to `/explore-1`.
- Copy: button **Chapter PYQ**; caption **previous year questions related to chapters**.
- Commit only when the user explicitly asks (repo rule). Skip commit steps until then.
- Follow existing Vitest `describe`/`it` style under `lib/`.

## File map

| File | Responsibility |
|------|----------------|
| `lib/chapter-pyq/catalog.ts` | Subjects, chapter rows, slug lookup, search filter, href helper |
| `lib/chapter-pyq/catalog.test.ts` | Catalog + routing helpers |
| `components/chapter-pyq/ChapterPyqListView.tsx` | Tabs, search, cards |
| `components/chapter-pyq/ChapterPyqPracticeView.tsx` | Empty practice shell |
| `app/chapter-pyq/page.tsx` | List route |
| `app/chapter-pyq/[subject]/[chapter]/page.tsx` | Practice route |
| `components/dashboard/RedesignedHomeDashboard.tsx` | Chapter PYQ button on LearnHub row |
| `components/dashboard/RedesignedHomeDashboard.module.css` | Button styles |
| `middleware.ts` | `/chapter-pyq` student-only |
| `components/providers/FreeTrialActivationGate.tsx` | Same prefix on the trial gate list |
| `app/robots.ts` | Disallow `/chapter-pyq` |

---

### Task 1: JEE Main chapter catalog

**Files:**
- Create: `lib/chapter-pyq/catalog.ts`
- Test: `lib/chapter-pyq/catalog.test.ts`

**Interfaces:**
- Consumes: `slugify` from `lib/slugs.ts`
- Produces:
  - `export type ChapterPyqSubject = "physics" | "chemistry" | "math"`
  - `export type ChapterPyqEntry = { slug: string; name: string; subject: ChapterPyqSubject }`
  - `export const CHAPTER_PYQ_SUBJECTS: { id: ChapterPyqSubject; label: string }[]`
  - `export const CHAPTER_PYQ_CHAPTERS: ChapterPyqEntry[]`
  - `export function isChapterPyqSubject(value: string): value is ChapterPyqSubject`
  - `export function chaptersForSubject(subject: ChapterPyqSubject): ChapterPyqEntry[]`
  - `export function findChapter(subject: string, slug: string): ChapterPyqEntry | null`
  - `export function filterChapters(chapters: ChapterPyqEntry[], query: string): ChapterPyqEntry[]`
  - `export function chapterPyqHref(entry: ChapterPyqEntry): string` → `/chapter-pyq/${subject}/${slug}`
  - `export const CHAPTER_PYQ_QUESTION_COUNT = 0`

- [ ] **Step 1: Write the failing test**

Create `lib/chapter-pyq/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CHAPTER_PYQ_CHAPTERS,
  CHAPTER_PYQ_QUESTION_COUNT,
  chapterPyqHref,
  chaptersForSubject,
  filterChapters,
  findChapter,
  isChapterPyqSubject,
} from "./catalog";

const MATH_NAMES = [
  "Application of Derivatives",
  "Area Under Curves",
  "Basic of Mathematics",
  "Binomial Theorem",
  "Circle",
  "Complex Number",
  "Continuity and Differentiability",
  "Definite Integration",
  "Determinants",
  "Differential Equations",
  "Differentiation",
  "Ellipse",
  "Functions",
  "Hyperbola",
  "Indefinite Integration",
  "Inverse Trigonometric Functions",
  "Limits",
  "Limits, Continuity and Differentiability",
  "Matrices",
  "Parabola",
  "Permutation Combination",
  "Probability",
  "Quadratic Equation",
  "Sequences and Series",
  "Sets and Relations",
  "Statistics",
  "Straight Lines",
  "Three Dimensional Geometry",
  "Trigonometric Equations",
  "Trigonometric Ratios and Identities",
  "Vector Algebra",
] as const;

describe("chapter PYQ catalog", () => {
  it("lists all 31 JEE Main math titles", () => {
    const math = chaptersForSubject("math").map((c) => c.name);
    expect(math).toEqual([...MATH_NAMES]);
  });

  it("keeps slugs unique per subject", () => {
    for (const subject of ["physics", "chemistry", "math"] as const) {
      const slugs = chaptersForSubject(subject).map((c) => c.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("finds a chapter and builds its href", () => {
    const circle = findChapter("math", "circle");
    expect(circle?.name).toBe("Circle");
    expect(chapterPyqHref(circle!)).toBe("/chapter-pyq/math/circle");
  });

  it("returns null for unknown subject or slug", () => {
    expect(findChapter("biology", "circle")).toBeNull();
    expect(findChapter("math", "nope")).toBeNull();
    expect(isChapterPyqSubject("math")).toBe(true);
    expect(isChapterPyqSubject("jee")).toBe(false);
  });

  it("filters by chapter name without changing question count", () => {
    expect(CHAPTER_PYQ_QUESTION_COUNT).toBe(0);
    const hits = filterChapters(chaptersForSubject("math"), "integ");
    expect(hits.map((c) => c.name)).toEqual([
      "Definite Integration",
      "Indefinite Integration",
    ]);
  });

  it("has 28 physics and 20 chemistry chapters", () => {
    expect(chaptersForSubject("physics")).toHaveLength(28);
    expect(chaptersForSubject("chemistry")).toHaveLength(20);
    expect(CHAPTER_PYQ_CHAPTERS).toHaveLength(31 + 28 + 20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/chapter-pyq/catalog.test.ts`

Expected: FAIL — `Cannot find module './catalog'`

- [ ] **Step 3: Write the catalog**

Create `lib/chapter-pyq/catalog.ts`. Build rows with `slugify(name)` so slugs stay derived, not hand-typed.

```ts
import { slugify } from "@/lib/slugs";

export type ChapterPyqSubject = "physics" | "chemistry" | "math";

export type ChapterPyqEntry = {
  slug: string;
  name: string;
  subject: ChapterPyqSubject;
};

export const CHAPTER_PYQ_QUESTION_COUNT = 0;

export const CHAPTER_PYQ_SUBJECTS: { id: ChapterPyqSubject; label: string }[] = [
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "math", label: "Mathematics" },
];

const MATH_NAMES = [ /* exact 31 strings from the test */ ];
const PHYSICS_NAMES = [
  "Units and Measurements",
  "Motion in a Straight Line",
  "Motion in a Plane",
  "Laws of Motion",
  "Work, Energy and Power",
  "System of Particles and Rotational Motion",
  "Gravitation",
  "Mechanical Properties of Solids",
  "Mechanical Properties of Fluids",
  "Thermal Properties of Matter",
  "Thermodynamics",
  "Kinetic Theory of Gases",
  "Oscillations",
  "Waves",
  "Electric Charges and Fields",
  "Electrostatic Potential and Capacitance",
  "Current Electricity",
  "Moving Charges and Magnetism",
  "Magnetism and Matter",
  "Electromagnetic Induction",
  "Alternating Current",
  "Electromagnetic Waves",
  "Ray Optics",
  "Wave Optics",
  "Dual Nature of Radiation and Matter",
  "Atoms",
  "Nuclei",
  "Semiconductor Electronics",
];
const CHEMISTRY_NAMES = [
  "Some Basic Concepts of Chemistry",
  "Structure of Atom",
  "Classification of Elements and Periodicity",
  "Chemical Bonding and Molecular Structure",
  "Chemical Thermodynamics",
  "Equilibrium",
  "Redox Reactions",
  "The p-Block Elements",
  "The d- and f-Block Elements",
  "Coordination Compounds",
  "Organic Chemistry – Basic Principles",
  "Hydrocarbons",
  "Haloalkanes and Haloarenes",
  "Alcohols, Phenols and Ethers",
  "Aldehydes, Ketones and Carboxylic Acids",
  "Amines",
  "Biomolecules",
  "Solutions",
  "Electrochemistry",
  "Chemical Kinetics",
];

function entries(subject: ChapterPyqSubject, names: readonly string[]): ChapterPyqEntry[] {
  return names.map((name) => ({ subject, name, slug: slugify(name) }));
}

export const CHAPTER_PYQ_CHAPTERS: ChapterPyqEntry[] = [
  ...entries("physics", PHYSICS_NAMES),
  ...entries("chemistry", CHEMISTRY_NAMES),
  ...entries("math", MATH_NAMES),
];

export function isChapterPyqSubject(value: string): value is ChapterPyqSubject {
  return value === "physics" || value === "chemistry" || value === "math";
}

export function chaptersForSubject(subject: ChapterPyqSubject): ChapterPyqEntry[] {
  return CHAPTER_PYQ_CHAPTERS.filter((c) => c.subject === subject);
}

export function findChapter(subject: string, slug: string): ChapterPyqEntry | null {
  if (!isChapterPyqSubject(subject)) return null;
  return CHAPTER_PYQ_CHAPTERS.find((c) => c.subject === subject && c.slug === slug) ?? null;
}

export function filterChapters(chapters: ChapterPyqEntry[], query: string): ChapterPyqEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return chapters;
  return chapters.filter((c) => c.name.toLowerCase().includes(needle));
}

export function chapterPyqHref(entry: ChapterPyqEntry): string {
  return `/chapter-pyq/${entry.subject}/${entry.slug}`;
}
```

Copy `MATH_NAMES` verbatim from the test. `slugify("Limits, Continuity and Differentiability")` must be `limits-continuity-and-differentiability` (comma dropped by `[^a-z0-9]+`). `Organic Chemistry – Basic Principles` uses an en dash — `slugify` must still produce a unique slug; if two names collide, fail the uniqueness test and disambiguate that one slug only.

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run lib/chapter-pyq/catalog.test.ts`

Expected: PASS (all tests)

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add lib/chapter-pyq/catalog.ts lib/chapter-pyq/catalog.test.ts
git commit -m "Add JEE Main Chapter PYQ catalog."
```

---

### Task 2: List and practice pages

**Files:**
- Create: `components/chapter-pyq/ChapterPyqListView.tsx`
- Create: `components/chapter-pyq/ChapterPyqPracticeView.tsx`
- Create: `app/chapter-pyq/page.tsx`
- Create: `app/chapter-pyq/[subject]/[chapter]/page.tsx`

**Interfaces:**
- Consumes: catalog helpers from Task 1
- Produces: `/chapter-pyq` (default Mathematics tab) and `/chapter-pyq/[subject]/[chapter]`
- Unknown subject/slug: practice view shows “Chapter not found” + Back to `/chapter-pyq`

- [ ] **Step 1: List view**

`ChapterPyqListView.tsx` — client component:

- Header: eyebrow `JEE Main`, `h1` **Chapter PYQ**, subtitle *Previous year questions related to chapters*
- Tabs from `CHAPTER_PYQ_SUBJECTS`, default state `"math"`
- Search input placeholder `Search chapters`
- Cards from `filterChapters(chaptersForSubject(subject), query)`
- Each card is a `Link` to `chapterPyqHref(entry)` showing `entry.name` and `0 questions` (use `CHAPTER_PYQ_QUESTION_COUNT`)
- Dark/card styles consistent with Learn Hub (`rounded-xl border border-border/50 bg-card/30`)

- [ ] **Step 2: Practice view**

`ChapterPyqPracticeView.tsx` — client component taking `{ subject: string; chapter: string }`:

- `const entry = findChapter(subject, chapter)`
- If null: heading **Chapter not found**, `Link` Back → `/chapter-pyq`
- If found: `Link` Back → `/chapter-pyq` (optional `?subject=` not required; path already encodes subject)
- Title `entry.name`; meta `{Physics|Chemistry|Mathematics} · JEE Main`
- Body: **Questions coming soon** — no question list, no options, no timer

- [ ] **Step 3: Routes**

`app/chapter-pyq/page.tsx`:

```tsx
import AppLayout from "@/components/AppLayout";
import ChapterPyqListView from "@/components/chapter-pyq/ChapterPyqListView";

export default function ChapterPyqPage() {
  return (
    <AppLayout>
      <ChapterPyqListView />
    </AppLayout>
  );
}
```

`app/chapter-pyq/[subject]/[chapter]/page.tsx`:

```tsx
import AppLayout from "@/components/AppLayout";
import ChapterPyqPracticeView from "@/components/chapter-pyq/ChapterPyqPracticeView";

export default async function ChapterPyqPracticePage({
  params,
}: {
  params: Promise<{ subject: string; chapter: string }>;
}) {
  const { subject, chapter } = await params;
  return (
    <AppLayout>
      <ChapterPyqPracticeView subject={subject} chapter={chapter} />
    </AppLayout>
  );
}
```

Match this repo’s Next params style (Promise vs sync) by copying a nearby dynamic page such as `app/doubts/[id]/page.tsx`.

- [ ] **Step 4: Typecheck the new files**

Run: `npx tsc --noEmit --pretty false 2>&1 | Select-String "chapter-pyq"`

Expected: no hits for these files.

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add app/chapter-pyq components/chapter-pyq
git commit -m "Add Chapter PYQ list and empty practice pages."
```

---

### Task 3: Chapter PYQ button on LearnHub

**Files:**
- Modify: `components/dashboard/RedesignedHomeDashboard.tsx` (the `optRow` map around the chips, ~lines 532–584)
- Modify: `components/dashboard/RedesignedHomeDashboard.module.css`

**Interfaces:**
- Consumes: `router.push("/chapter-pyq")`
- Produces: LearnHub-only nested button; other Prep rows unchanged

- [ ] **Step 1: Nest the button after chips, LearnHub only**

Inside the `optRow` `onClick` map, keep LearnHub’s row click as `router.push("/explore-1")`.

After `{data.chips.map(...)}` in `optBody`, when `key === "learnhub"` render:

```tsx
<button
  type="button"
  className={styles.chapterPyqBtn}
  onClick={(e) => {
    e.stopPropagation();
    router.push("/chapter-pyq");
  }}
>
  <span className={styles.chapterPyqBtnLabel}>Chapter PYQ</span>
  <span className={styles.chapterPyqBtnCaption}>
    previous year questions related to chapters
  </span>
</button>
```

Do not add this button to Classes / Gyan++ / Planner rows.

- [ ] **Step 2: Styles**

In `RedesignedHomeDashboard.module.css`, after `.chip`:

```css
.chapterPyqBtn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 0.5px solid rgba(29, 158, 117, 0.45);
  background: rgba(29, 158, 117, 0.12);
  cursor: pointer;
  text-align: left;
  max-width: 280px;
}
.chapterPyqBtnLabel {
  font-size: 13px;
  font-weight: 700;
  color: #9fe1cb;
}
.chapterPyqBtnCaption {
  font-size: 11px;
  line-height: 1.4;
  color: var(--t2);
}
```

- [ ] **Step 3: Manual check**

From `/home?page=prep`: tapping the LearnHub row (title/arrow) → `/explore-1`. Tapping **Chapter PYQ** → `/chapter-pyq`. Math tab shows the 31 names. Tapping **Circle** → `/chapter-pyq/math/circle` with **Questions coming soon**.

- [ ] **Step 4: Commit (only if the user asked)**

```bash
git add components/dashboard/RedesignedHomeDashboard.tsx components/dashboard/RedesignedHomeDashboard.module.css
git commit -m "Add Chapter PYQ entry on the LearnHub card."
```

---

### Task 4: Auth gate and robots

**Files:**
- Modify: `middleware.ts` — add `"/chapter-pyq"` to `STUDENT_ONLY_PREFIXES` next to `"/explore-1"`
- Modify: `components/providers/FreeTrialActivationGate.tsx` — add `"/chapter-pyq"` to `STUDENT_APP_GATE_PREFIXES`
- Modify: `app/robots.ts` — add `"/chapter-pyq"` to `disallow` next to `"/explore-1"`
- Test: `lib/auth/middlewareMatcher.test.ts` — add `"/chapter-pyq"` to the `guards` `it.each` list

**Interfaces:**
- Consumes: existing student-only redirect
- Produces: teachers hitting `/chapter-pyq` follow the same rule as `/explore-1`; crawlers disallowed

- [ ] **Step 1: Extend the matcher test**

Add `"/chapter-pyq"` (and optionally `"/chapter-pyq/math/circle"`) to the guarded path list in `lib/auth/middlewareMatcher.test.ts`.

- [ ] **Step 2: Run the matcher test**

Run: `npx vitest run lib/auth/middlewareMatcher.test.ts`

Expected: PASS (matcher already covers app routes; this locks the prefix in the suite)

- [ ] **Step 3: Wire middleware, trial gate, robots**

Same string `"/chapter-pyq"` in all three files. Do not mark it public.

- [ ] **Step 4: Re-run catalog + matcher tests**

Run: `npx vitest run lib/chapter-pyq/catalog.test.ts lib/auth/middlewareMatcher.test.ts`

Expected: PASS

- [ ] **Step 5: Commit (only if the user asked)**

```bash
git add middleware.ts components/providers/FreeTrialActivationGate.tsx app/robots.ts lib/auth/middlewareMatcher.test.ts
git commit -m "Gate Chapter PYQ like Learn Hub."
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Button on LearnHub row, caption, stopPropagation | 3 |
| LearnHub still → `/explore-1` | 3 |
| `/chapter-pyq` list, default Math, search, 0 questions | 1 + 2 |
| 31 math titles | 1 |
| Physics 28 / Chemistry 20 | 1 |
| `/chapter-pyq/[subject]/[chapter]` coming soon | 2 |
| Unknown slug does not crash | 1 + 2 |
| AppLayout, student-only | 2 + 4 |
| No import / scoring / PDF / CBSE mix | all (omitted) |

## Placeholder scan

No TBD steps. Commit steps are gated on explicit user request.
