# Classroom bulk invite rewards

## Product rule

When a teacher **bulk-imports student emails** into a classroom:

1. **+5,000 RDM flat** — first batch in that classroom with **≥20 newly-invited** distinct emails (not already on the classroom invite list).
2. **+100 RDM per student** — each invited email whose account goes **paid via Razorpay** within **7 days** of `invited_at`.

Example: 40-student batch, 35 subscribe within 7 days → **5,000 + (35 × 100) = 8,500 RDM** (flat once per classroom).

Stacks independently with the teacher **referral link** track (+500 / +500).

## Flow

- Teacher uses **Invite students → Bulk Invite** (`components/InviteStudents.tsx`) → `POST /api/teacher/classroom/:id/bulk-invite` → RPC `create_classroom_bulk_invite`.
- Invited student signs up with matching email → onboarding calls `POST /api/user/classroom-invites/link` → RPC `link_my_classroom_invites` (auto-enroll).
- Student pays via Razorpay → `activate-after-payment` → RPC `award_classroom_batch_paid_bonus`.

## DB

- Migration: `supabase/migrations/20260926120000_classroom_bulk_invite_rewards.sql`
- Tables: `classroom_invite_batches`, `classroom_invite_recipients` (unique `classroom_id + email`)
- Config keys: `classroom_bulk_invite_min_students`, `classroom_bulk_invite_flat_rdm`, `classroom_batch_paid_bonus_rdm`, `classroom_batch_paid_window_days`

## Invitation emails

- After `create_classroom_bulk_invite`, `sendClassroomInviteEmails` sends one email per **new** row in that batch (`classroom_invite_recipients.batch_id`).
- Skips students **already in the class** (member email) or **already linked** on a prior invite.
- Duplicate emails / re-imports produce no new rows → no email.
- Requires `EMAIL_SERVER_*` env; logged as `other` in `transactional_email_logs`.
- Templates: `lib/email/classroomInviteEmail.ts`, sender: `lib/email/sendClassroomInviteEmails.ts`.

## Out of scope (v1)

- ~~No transactional email sent to invited addresses; teacher still shares join link manually.~~ (Added 2026-06-25)

## Verification (2026-06-25)

Live DB rollback-style tests (8/8 pass): flat 5k, no second flat, reimport skip, small batch, link/enroll, paid +100, idempotent paid, window expired.
