# Chapter PYQ — format and flow

**Status:** Approved  
**Product:** EduBlast Web  
**Date:** 2026-09-11  
**Branch:** `edudeca`

## Goal

Students can open a **Chapter PYQ** path from Learn Hub, browse **JEE Main** chapters (Class 11 + 12 together) by subject, and land on a practice URL that will later hold chapter-wise previous-year questions. This version ships **format, view, and flow only**. Questions are imported later.

## Decisions

| Topic | Choice |
|-------|--------|
| Entry | Button on the Prep **LearnHub** row, not a new Prep card, not inside `/explore-1` |
| LearnHub row click | Unchanged → `/explore-1` (lessons) |
| Exam | JEE Main only |
| Chapter set | Full JEE chapter-wise list (XI + XII combined), not CBSE packing |
| Subjects | Physics, Chemistry, Mathematics |
| On chapter tap | In-app practice route (not PDF download) |
| Questions now | None. Empty state: **Questions coming soon** |
| Grouping | One combined list per subject. No unit taxonomy until questions exist |
| Scoring / RDM / attempts | Out of scope |
| Mapping existing 137 full JEE papers onto chapters | Out of scope |

## Entry

On `/home?page=prep`, under the LearnHub chips:

- Button label: **Chapter PYQ**
- Caption: **previous year questions related to chapters**
- Click must `stopPropagation` so it does not open Learn Hub
- Navigates to `/chapter-pyq`

The LearnHub **detail** page (`/home?page=prep&detail=learnhub` if used) can show the same button; not required for v1 if that route is unused.

## Routes

| Path | Page |
|------|------|
| `/chapter-pyq` | Subject tabs + chapter list |
| `/chapter-pyq/[subject]/[chapter]` | Practice shell for one chapter |

`subject` is `physics` \| `chemistry` \| `math`.  
`chapter` is a stable slug from the catalog (e.g. `circle`, `definite-integration`).

Unknown subject or slug → back to `/chapter-pyq` (or a simple not-found with Back).

Both pages use `AppLayout`. Signed-in student access, same as Learn Hub.

## Chapter list (`/chapter-pyq`)

- Header: **Chapter PYQ**, eyebrow **JEE Main**, subtitle *Previous year questions related to chapters*
- Tabs: Physics · Chemistry · Mathematics (default **Mathematics**)
- Search filters the active subject’s chapter names
- Each row/card: chapter name, **0 questions**, whole card is the tap target
- Dark Prep visual language (not the white PDF table from the source site)

Catalog is a **static TypeScript module** (not `curriculum_chapters`, not `MCQ_CHAPTERS`). Those trees stay CBSE/lesson-shaped.

Mathematics v1 matches the 31 titles from the JEE Main chapter PDF:

1. Application of Derivatives  
2. Area Under Curves  
3. Basic of Mathematics  
4. Binomial Theorem  
5. Circle  
6. Complex Number  
7. Continuity and Differentiability  
8. Definite Integration  
9. Determinants  
10. Differential Equations  
11. Differentiation  
12. Ellipse  
13. Functions  
14. Hyperbola  
15. Indefinite Integration  
16. Inverse Trigonometric Functions  
17. Limits  
18. Limits, Continuity and Differentiability  
19. Matrices  
20. Parabola  
21. Permutation Combination  
22. Probability  
23. Quadratic Equation  
24. Sequences and Series  
25. Sets and Relations  
26. Statistics  
27. Straight Lines  
28. Three Dimensional Geometry  
29. Trigonometric Equations  
30. Trigonometric Ratios and Identities  
31. Vector Algebra  

Physics v1 (28):

1. Units and Measurements  
2. Motion in a Straight Line  
3. Motion in a Plane  
4. Laws of Motion  
5. Work, Energy and Power  
6. System of Particles and Rotational Motion  
7. Gravitation  
8. Mechanical Properties of Solids  
9. Mechanical Properties of Fluids  
10. Thermal Properties of Matter  
11. Thermodynamics  
12. Kinetic Theory of Gases  
13. Oscillations  
14. Waves  
15. Electric Charges and Fields  
16. Electrostatic Potential and Capacitance  
17. Current Electricity  
18. Moving Charges and Magnetism  
19. Magnetism and Matter  
20. Electromagnetic Induction  
21. Alternating Current  
22. Electromagnetic Waves  
23. Ray Optics  
24. Wave Optics  
25. Dual Nature of Radiation and Matter  
26. Atoms  
27. Nuclei  
28. Semiconductor Electronics  

Chemistry v1 (20):

1. Some Basic Concepts of Chemistry  
2. Structure of Atom  
3. Classification of Elements and Periodicity  
4. Chemical Bonding and Molecular Structure  
5. Chemical Thermodynamics  
6. Equilibrium  
7. Redox Reactions  
8. The p-Block Elements  
9. The d- and f-Block Elements  
10. Coordination Compounds  
11. Organic Chemistry – Basic Principles  
12. Hydrocarbons  
13. Haloalkanes and Haloarenes  
14. Alcohols, Phenols and Ethers  
15. Aldehydes, Ketones and Carboxylic Acids  
16. Amines  
17. Biomolecules  
18. Solutions  
19. Electrochemistry  
20. Chemical Kinetics  

Rename any of these when question files arrive. Each catalog row: `{ slug, name, subject }`. `questionCount` is always `0` until import.

## Practice shell (`/chapter-pyq/[subject]/[chapter]`)

- Back → `/chapter-pyq` (keep the same subject tab via query `?subject=` or from the path)
- Title: chapter name  
- Meta: subject label + JEE Main  
- Body: empty state **Questions coming soon** — no dummy MCQs, timer, or NTA palette

This URL is the future home of real PYQs. Do not invent a second practice route later if we can load questions here.

## Non-goals (this version)

- Importing PDFs/JSON  
- Tagging the existing 137 JEE Main full papers by chapter  
- CBSE / KCET filters  
- Download PDF  
- Learn Hub lesson deep-links from a PYQ chapter  
- RDM, attempt limits, resume, answer-key leak rules (those belong to the question-import spec)

## Testing (when implementing)

- LearnHub card still goes to `/explore-1`  
- Chapter PYQ button goes to `/chapter-pyq` and does not navigate to Learn Hub  
- Math tab lists all 31 names  
- Chapter card opens the matching practice URL  
- Unknown slug does not crash  
- Practice page shows coming-soon, not a quiz

## Follow-up (not this spec)

When chapter question files exist: import into a chapter-keyed store, set counts on the list, render questions on the same practice URL. Revisit grouping, search, and exam mix then.
