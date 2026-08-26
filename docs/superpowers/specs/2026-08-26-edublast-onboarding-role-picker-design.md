# Edublast onboarding role after user delete

**Status:** Approved (Approaches 1 + 2)  
**Product:** Web (Edublast) only  
**Date:** 2026-08-26

## Goal

After a Google account is deleted in Supabase Auth and the same Gmail signs in again, Edublast must not skip to Teacher Profile. The person chooses Student or Teacher. Leftover waitlist data is documented so a test wipe can be a full reset.

## Problem

Deleting `auth.users` does not delete `approved_emails`. That table is keyed by email. A new Google user is created as `student`, then whitelist sync and onboarding skip logic send them to Teacher Profile when the email is still approved as teacher. EduBite has no roles, so it looks fine. EduDeca tables are separate.

## Decisions

| Topic | Choice |
|-------|--------|
| Welcome back / sign-in | Always show the Student / Teacher picker if onboarding is incomplete |
| Sign up as Teacher / Student | Skip picker and open that role’s form (explicit choice) |
| Whitelist | Still grants access. Does not pick the onboarding screen on sign-in |
| Save as Student | Honored even if `approved_emails.role` is teacher |
| Save as Teacher | Still requires `approved_emails.role = teacher` |
| Test wipe | Checklist: Auth user is not enough; also change or delete `approved_emails` |

## User-facing behavior

1. Incomplete onboarding + `auth_mode = signin` (or no signup mode) → **Who are you?** picker.
2. Incomplete onboarding + `auth_mode = signup` and a chosen role (URL or stored intent) → that role’s details form.
3. Completing Student setup writes `profiles.role = student` and `onboarding_complete = true`.
4. Completing Teacher setup still fails without a teacher whitelist row.

## Non-goals

- Changing EduBite or EduDeca login.
- Auto-deleting `approved_emails` when Auth users are deleted (production teachers should keep access if they return).
- Building a new admin “reset user” app. Use the existing approved-emails admin list plus the checklist.

## Architecture

- Pure helper decides picker vs details (`resolveOnboardingEntry`).
- `useAuth` does not copy whitelist role onto the profile or into `auth_intended_role` on sign-in.
- Empty teacher rows are not auto-marked complete just because the flow is sign-in.
- `complete_user_onboarding` prefers the requested student role over whitelist teacher.

## Testing

Unit tests at those helpers and the onboarding-repair predicate. Manual: delete Auth user, Welcome back with Google, confirm picker; Sign up as Teacher still opens teacher form.
