# Edublast onboarding role picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Welcome-back Google login shows the Student/Teacher picker instead of Teacher Profile, while explicit signup still skips to the chosen form; document leftover `approved_emails` for test wipes.

**Architecture:** Extract a pure onboarding-entry helper and a whitelist-sync predicate. Wire onboarding and `useAuth` to them. Change `complete_user_onboarding` so a requested student role wins over a teacher whitelist row. Add a short test-user reset checklist.

**Tech Stack:** Next.js App Router, Vitest, Supabase SQL migrations.

## Global Constraints

- Web (Edublast) only — no EduBite / EduDeca auth changes.
- Teacher save still requires `approved_emails.role = teacher`.
- Do not cascade-delete whitelist rows when Auth users are deleted.
- Follow existing Vitest + `describe`/`it` style under `Web/lib`.

---

### Task 1: Onboarding entry helper

**Files:**
- Create: `Web/lib/onboarding/resolveOnboardingEntry.ts`
- Test: `Web/lib/onboarding/resolveOnboardingEntry.test.ts`
- Modify: `Web/app/onboarding/page.tsx` (role/step effect)

**Interfaces:**
- Produces: `resolveOnboardingEntry(input) => { role, step }`
- `authMode === "signup"` with a role → `{ step: "details" }`
- otherwise incomplete → `{ step: "role" }` unless profile load timed out → student details

- [x] **Step 1–5:** Tests first, then helper, then wire onboarding page.

### Task 2: Whitelist sync on sign-in

**Files:**
- Create: `Web/lib/auth/whitelistRoleSync.ts`
- Test: `Web/lib/auth/whitelistRoleSync.test.ts`
- Modify: `Web/hooks/useAuth.tsx`
- Modify: `Web/lib/profile/profileOnboardingRepair.ts`
- Test: `Web/lib/profile/profileOnboardingRepair.test.ts`

**Interfaces:**
- Produces: `shouldApplyWhitelistRoleToProfile(isSignIn: boolean): boolean` — false on sign-in
- Empty teacher + `isSignIn` must not force `onboarding_complete`

- [x] **Step 1–5:** Tests first, then predicates, then useAuth / repair.

### Task 3: Save student even if whitelist is teacher

**Files:**
- Create: `Web/supabase/migrations/20260826234500_complete_onboarding_requested_student.sql`

- [x] Requested `student` sets `target_role` to student before whitelist teacher.

### Task 4: Test-user reset checklist

**Files:**
- Create: `Web/docs/test-user-reset.md`

- [x] Checklist: Auth Users, `approved_emails`, leftover `profiles` / EduDeca tables.

### Task 5: Verify

- [x] `npx vitest run` on the new tests
- [x] Web typecheck
