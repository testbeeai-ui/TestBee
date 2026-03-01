# Public Student Profile — Full Architecture Document

## 1. Data Layer

**Interfaces define the shape of every profile:**

```typescript
// Academic records with verification
AcademicRecord { exam, board, score, verified: 'verified' | 'pending' | 'unverified' }

// Competitions with level hierarchy
Achievement { name, level: 'School'|'District'|'State'|'National'|'International', year, result }

// Transparent RDM scoring breakdown
RdmBreakdown { answersGiven, acceptedBonus, mockTests, streakBonus, bountiesWon, doubtsAsked }

// Main profile combining everything
PublicProfile {
  id, name, initials, avatarColor, avatarUrl, bio,
  rdm, rank ('Novice'|'Scholar'|'Expert'|'Master'), memberSince,
  questionsAsked, answersGiven, acceptedAnswers, strikeRate,
  subjectStats: { physics, chemistry, math, biology },
  rdmFromDoubts, bountiesWon, streakDays, badges[],
  recentDoubts[], recentAnswers[],
  nextRankRdm, academics[], achievements[], rdmBreakdown
}
```

**Lookup helper:** `getPublicProfile(userId)` fetches profile from Supabase.

**Color maps** are exported for rank badges and subject bars so the UI stays consistent.

---

## 2. Routing

```
Route: /user/[id] → PublicProfilePage
```

The `[id]` param (UUID) is extracted via `useParams()` and passed to `getPublicProfile(id)`.

---

## 3. UI Page (`app/user/[id]/page.tsx`)

The page is composed of **8 stacked card sections** inside `AppLayout`, each wrapped in `edu-card`:

| # | Section | Data Source | Key Visual |
|---|---------|-------------|------------|
| 1 | **Header** | name, initials, bio, rank, rdm, memberSince, streakDays, badges | Avatar circle with initials + rank badge + badge pills |
| 2 | **Stats Grid** | questionsAsked, answersGiven, acceptedAnswers, strikeRate | 4-column grid with icons + big numbers |
| 3 | **Academic Record** | `academics[]` | Rows with exam/board/score + verification icon |
| 4 | **Achievements** | `achievements[]` | Rows with competition name + level badge + year + result |
| 5 | **RDM Breakdown** | `rdmBreakdown` | Horizontal bars proportional to max value, total at bottom |
| 6 | **Subject Breakdown** | `subjectStats` | Colored horizontal bars (physics, chemistry, math, biology) |
| 7 | **Reputation** | rdmFromDoubts, bountiesWon, streakDays, rdm/nextRankRdm | 3-stat row + progress bar for rank progress |
| 8 | **Recent Activity** | recentDoubts[], recentAnswers[] | Side-by-side cards listing recent questions and answers |

---

## 4. User Hover Card (Condensed Profile)

When hovering over a username/avatar anywhere in the app, show a compact card:

- Avatar, Name, Rank badge, Bio, RDM, Member since
- Badges (Top 5 this week, subject Pro)
- 4 Stat Pills: Asked, Answered, Accepted, Strike %
- Subject Breakdown: Mini progress bars
- Progress bar to next rank
- Streak info
- Recent Doubts and Recent Answers (short list)
- "View Full Profile →" link to `/user/[id]`

---

## 5. Design Patterns

- **Semantic color tokens** (`text-foreground`, `bg-muted`, `text-muted-foreground`, `text-primary`, `text-edu-orange`) — no hardcoded colors
- **Config objects for variants** — `verificationConfig`, `levelColors`, `subjectBarColors`, `rankColors` map data values to styling
- **Proportional bars** — each bar width = `(value / maxValue) * 100%`
- **Responsive layout** — `grid-cols-2 sm:grid-cols-4` for stats
- **Icon composition** — Lucide icons paired with section headers

---

## 6. Reusable Prompt (Copy-Paste Ready)

```
Build a public student profile page at /user/[id] with these sections:

1. HEADER: Avatar (initials + color), name, rank badge, bio, RDM score,
   member-since date, streak days, achievement badges as pills.

2. STATS GRID: 4 cards — Questions Asked, Answers Given, Accepted Answers,
   Strike Rate — each with an icon and large number.

3. ACADEMIC RECORD: Table of exams (Class 10, 12, etc.) with board name,
   percentage score, and verification status (Verified/Pending/Unverified)
   shown as colored icons.

4. ACHIEVEMENTS: List of competitions with name, level badge
   (School/District/State/National/International — each a different color),
   year, and result.

5. RDM BREAKDOWN: Horizontal bar chart showing points from: Answers Given,
   Accepted Bonus, Mock Tests, Streak Bonus, Bounties Won, Doubts Asked.
   Each bar proportional to max value. Total shown at bottom.

6. SUBJECT BREAKDOWN: Horizontal bars for Physics, Chemistry, Math, Biology
   with subject-specific colors. Total count shown below.

7. REPUTATION: Three stats (RDM from Doubts, Bounties Won, Active Streak)
   + progress bar showing rank advancement.

8. RECENT ACTIVITY: Side-by-side cards listing recent doubts and answers.

Tech: React + TypeScript + Tailwind + Lucide icons + Radix Progress.
Use semantic design tokens, no hardcoded colors.
Data from Supabase (profiles, doubts, doubt_answers).
Responsive: 4-col on desktop, 2-col on mobile for stats grid.
```
