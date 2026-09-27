# Chapter PYQ Practice and Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each chapter set offers Start Practice (today’s full paper) and Start Test (a capped random draw, a custom clock, and +4/−1/0 marks on the same paper).

**Architecture:** Pure helpers decide whether a setup is valid, draw the subset, and compute marks. The existing `ChapterPyqExamSession` gains an optional test clock and a marks result. Both set lists share one setup panel and pass either the full set or the drawn subset into that session.

**Tech Stack:** Next.js, React, TypeScript, Vitest (`npx vitest run` from `Web`).

## Global Constraints

- Practice opens every question in the set, in the current order, at 2 minutes each, and ends on a correct count.
- Test question count is a whole number from 1 through the set size. Minutes per question is a whole number of 1 or more. Default count is the set size. Default minutes is 2.
- Total time is count × minutes.
- Each Begin Test shuffles the full set and takes the requested count. Try again repeats that same list, order, count, and minutes.
- Marks: right +4, wrong −1, blank 0. Maximum is 4 × question count. Tips, Formulas, and Solution stay available and do not change marks.
- Practice results do not show marks.
- Both `/chapter-pyq` and `/chapter-pyq/[subject]/[chapter]` get both actions, for every subject.
- Assorted Test is out of scope. Do not copy the reference screenshot layout.
- Answered questions still update Attempted / Right / Wrong.

---

### Task 1: Test setup, draw, and marks

**Files:**
- Create: `Web/lib/chapter-pyq/pyqTestSetup.ts`
- Test: `Web/lib/chapter-pyq/pyqTestSetup.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `parsePyqTestSetup(countRaw: string, minutesRaw: string, maxQuestions: number): { ok: true; questionCount: number; minutesPerQuestion: number } | { ok: false }`
  - `pyqTestTotalMinutes(questionCount: number, minutesPerQuestion: number): number`
  - `drawPyqTestQuestions<T>(items: readonly T[], count: number, random?: () => number): T[]`
  - `pyqTestMarks(correct: number, wrong: number): number`
  - `pyqTestMaxMarks(questionCount: number): number`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  drawPyqTestQuestions,
  parsePyqTestSetup,
  pyqTestMarks,
  pyqTestMaxMarks,
  pyqTestTotalMinutes,
} from "./pyqTestSetup";

describe("pyq test setup", () => {
  it("accepts a count inside the set and whole minutes", () => {
    expect(parsePyqTestSetup("4", "2", 9)).toEqual({
      ok: true,
      questionCount: 4,
      minutesPerQuestion: 2,
    });
  });

  it("rejects a count above the set, below 1, blank, or fractional", () => {
    expect(parsePyqTestSetup("10", "2", 9).ok).toBe(false);
    expect(parsePyqTestSetup("0", "2", 9).ok).toBe(false);
    expect(parsePyqTestSetup("", "2", 9).ok).toBe(false);
    expect(parsePyqTestSetup("2.5", "2", 9).ok).toBe(false);
    expect(parsePyqTestSetup("4", "0", 9).ok).toBe(false);
    expect(parsePyqTestSetup("4", "1.5", 9).ok).toBe(false);
  });

  it("multiplies count by minutes", () => {
    expect(pyqTestTotalMinutes(9, 2)).toBe(18);
  });

  it("draws a unique subset using the injected random source", () => {
    const drawn = drawPyqTestQuestions(["a", "b", "c", "d"], 2, () => 0);
    expect(drawn).toHaveLength(2);
    expect(new Set(drawn).size).toBe(2);
    expect(["a", "b", "c", "d"]).toEqual(expect.arrayContaining(drawn));
  });

  it("scores +4 right, −1 wrong, and ignores blanks in the formula", () => {
    expect(pyqTestMarks(3, 1)).toBe(11);
    expect(pyqTestMaxMarks(9)).toBe(36);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `Web`: `npx vitest run lib/chapter-pyq/pyqTestSetup.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
export type PyqTestSetup =
  | { ok: true; questionCount: number; minutesPerQuestion: number }
  | { ok: false };

function wholeNumber(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

export function parsePyqTestSetup(
  countRaw: string,
  minutesRaw: string,
  maxQuestions: number
): PyqTestSetup {
  const questionCount = wholeNumber(countRaw);
  const minutesPerQuestion = wholeNumber(minutesRaw);
  if (
    questionCount === null ||
    minutesPerQuestion === null ||
    maxQuestions < 1 ||
    questionCount < 1 ||
    questionCount > maxQuestions ||
    minutesPerQuestion < 1
  ) {
    return { ok: false };
  }
  return { ok: true, questionCount, minutesPerQuestion };
}

export function pyqTestTotalMinutes(questionCount: number, minutesPerQuestion: number): number {
  return questionCount * minutesPerQuestion;
}

export function drawPyqTestQuestions<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const current = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = current;
  }
  return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
}

export function pyqTestMarks(correct: number, wrong: number): number {
  return correct * 4 + wrong * -1;
}

export function pyqTestMaxMarks(questionCount: number): number {
  return questionCount * 4;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/chapter-pyq/pyqTestSetup.test.ts`

Expected: PASS

---

### Task 2: Test clock and marks on the existing paper

**Files:**
- Modify: `Web/components/chapter-pyq/ChapterPyqExamSession.tsx`
- Modify: `Web/components/chapter-pyq/ChapterPyqResultView.tsx`

**Interfaces:**
- Consumes: `pyqTestMarks`, `pyqTestMaxMarks` from Task 1; existing `pyqReviewVerdict`
- Produces: session props `mode?: "practice" | "test"` (default `"practice"`) and `minutesPerQuestion?: number` (default `2`). Test mode passes marks into the result view. Practice omits them.

- [ ] **Step 1: Extend the session**

Add the two optional props. Clock:

```ts
const minutes = mode === "test" ? Math.max(1, minutesPerQuestion ?? 2) : 2;
const totalSeconds = questions.length * minutes * 60;
```

Replace the `secondsForSet(questions.length)` clock when `mode === "test"`. Practice keeps `secondsForSet`.

On the result view, when `mode === "test"`, compute correct / wrong / skipped with `pyqReviewVerdict` and pass:

```ts
marks={{
  earned: pyqTestMarks(correct, wrong),
  maximum: pyqTestMaxMarks(entries.length),
}}
```

Practice passes no `marks` prop.

- [ ] **Step 2: Show marks only for a test**

Add optional `marks?: { earned: number; maximum: number }` to `ChapterPyqResultView`. When `marks` is present, the headline is `` `${marks.earned} / ${marks.maximum}` `` with a “marks” label. The correct / wrong / skipped grid stays. When `marks` is absent, the headline stays `` `${score} / ${entries.length} correct` ``.

- [ ] **Step 3: Confirm practice callers still typecheck**

Existing `<ChapterPyqExamSession>` calls omit the new props, so they stay practice at 2 minutes. Run `npx vitest run lib/chapter-pyq/pyqScoring.test.ts lib/chapter-pyq/pyqTestSetup.test.ts` from `Web`. Expected: PASS.

---

### Task 3: Start Practice, Start Test, and the setup step

**Files:**
- Create: `Web/components/chapter-pyq/ChapterPyqTestSetup.tsx`
- Modify: `Web/components/chapter-pyq/ChapterPyqListView.tsx` (set rows and session launch in `ChapterPracticeModal`)
- Modify: `Web/components/chapter-pyq/ChapterPyqPracticeView.tsx` (the same launch behavior)

**Interfaces:**
- Consumes: `parsePyqTestSetup`, `pyqTestTotalMinutes`, `drawPyqTestQuestions`; session props from Task 2
- Produces: a setup panel with count, minutes, live total, Cancel, and Begin Test. Begin calls `onBegin(questionCount, minutesPerQuestion)` only when parse succeeds.

- [ ] **Step 1: Add the setup panel**

`ChapterPyqTestSetup` props: `setLabel: string`, `maxQuestions: number`, `onCancel: () => void`, `onBegin: (questionCount: number, minutesPerQuestion: number) => void`.

Local state starts as `String(maxQuestions)` and `"2"`. Begin calls `parsePyqTestSetup` and invokes `onBegin` only when `ok` is true. Show `pyqTestTotalMinutes` when the parse succeeds, and a short invalid message when it does not. Use the existing dark modal classes (`border-[#1F2436]`, `bg-[#121624]`, `text-[#F8FAFC]`). Two fields, Cancel, Begin Test. No tip or formula scoring rows.

- [ ] **Step 2: Split each set row into two actions**

In both set lists, replace the single Start button with a row that is not one big button. **Start Practice** sets the active set index and leaves test state empty, which mounts `ChapterPyqExamSession` with the full `activeSet.items` and no test props.

**Start Test** stores `{ setIndex, maxQuestions }` and renders `ChapterPyqTestSetup` instead of the exam. **Begin Test** runs `drawPyqTestQuestions(activeSet.items, count)` and stores `{ questions, minutesPerQuestion }` plus a session nonce. The session then receives those drawn questions, `mode="test"`, and `minutesPerQuestion`.

**Cancel** clears the setup state. **Try again** (`onRetry`) only increments the nonce, so the stored draw is reused. **Begin Test** always replaces the stored draw. **Exit** clears the draw and the setup.

Keep the listed question count and the 2-minute practice duration on the row, since that line describes the full set.

- [ ] **Step 3: Run the unit tests**

Run from `Web`: `npx vitest run lib/chapter-pyq/pyqTestSetup.test.ts lib/chapter-pyq/pyqScoring.test.ts`

Expected: PASS
