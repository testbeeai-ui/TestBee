# Board / syllabus content routes

This folder is the **easiest path** for content that depends on board or exam.

## URL shape

- **CBSE (current):** `/cbse/physics/class-11/thermodynamics/...`
- **JEE Mains (when you add it):** `/jee-mains/physics/class-11/...` — use `board = "jee-mains"` and add JEE Mains–specific theory/weightage in the same structure.

## Structure

```
[board]          → e.g. cbse | jee-mains | jee-advance (add as needed)
  [subject]      → physics | chemistry | math | biology
  [grade]        → class-11 | class-12
  [unit]         → unit slug (e.g. thermodynamics)
  [topic]        → topic slug
  [level]        → basics | intermediate | advanced
```

- **CBSE:** All current unit/topic content and exam weightage live here (and in explore-1). This is the only board with content today.
- **JEE Mains / JEE Advance:** When you add exam-specific information (theory, weightage, or pages), add pages or data under the same `[board]/[subject]/[grade]/[unit]/[topic]/[level]` structure with `board = "jee-mains"` or `"jee-advance"`. Tell the app (or Cursor) “this is JEE Mains information” and put it under the corresponding board path.

## Explore-1 vs board routes

- **Explore Learning (explore-1):** Unit list and unit detail page are **CBSE only**. Exam (JEE Mains, KCET, etc.) only filters **practice questions**, not the unit text or weightage.
- **Board routes:** Used when you have board- or exam-specific content. Link to `/jee-mains/...` when you have real JEE Mains content; until then, keep using CBSE and explore-1.
