# Teacher Charge Model — Phase 1

## Scope shipped

- **Tiers:** `profiles.teacher_plan_tier` (`free` | `starter` | `pro`) + `teacher_plan_started_at` / `teacher_plan_expires_at` (separate from student `plan_tier`).
- **Pricing:** Starter ₹999/mo, Pro ₹1,999/mo + 18% GST via Razorpay (`purpose: teacher_subscription`).
- **Live classes:** Explicit `live_class_slots` booking (one Google Calendar event + Meet per slot, no RRULE). Monthly caps: Free 0, Starter 4, Pro 12 (IST month, `rdm_config`-tunable).
- **Gates:** Starter 10 assignments/mo; Pro unlimited (9999 sentinel); 30 students/class on join approve + bulk invite; Free blocked from assignments.
- **Coupons:** `teacher_subscription_coupons` (Basic=starter, Premium=pro); admin generator + teacher claim on Subscriptions.
- **RDM repoint:** Delivery + quality RDM + student rating RPCs key off `live_class_slots.slot_at` as `occurrence_at`. TS math in `liveClassDeliveryRdm.ts` / `liveClassQualityRdm.ts` unchanged.

## Key paths

| Area | Path |
|------|------|
| Plan lib + tests | `lib/teacherPortal/teacherPlan.ts`, `teacherPlan.test.ts` |
| Server enforcement | `lib/teacherPortal/teacherPlanServer.ts` |
| Checkout summary | `lib/subscription/teacherCheckoutSummary.ts` |
| Book slot API | `app/api/teacher/live-classes/book/route.ts` |
| Activate payment | `app/api/teacher/subscription/activate-after-payment/route.ts` |
| Plan limits API | `app/api/teacher/plan/limits/route.ts` |
| Plan coupon claim | `app/api/teacher/coupons/claim-plan/route.ts` |
| Admin plan coupons | `app/api/admin/coupons/teacher-plan/route.ts` |
| UI — subscriptions | `TeacherPlanSubscriptionSection.tsx` in Subscriptions |
| UI — slot booking | `BookLiveClassSlotPanel.tsx` in My Classroom sections |
| Migrations | `20260930120000` … `20260930150000` |

## Migrations (prod applied 2026-06-26)

1. `20260930120000_teacher_plan_tier.sql` — columns + `rdm_config` cap keys
2. `20260930130000_live_class_slots.sql` — slot table + RLS
3. `20260930140000_teacher_slots_rdm_repoint.sql` — delivery scanner + rating RPCs + quality award duration from slots
4. `20260930150000_teacher_subscription_coupons.sql` — plan coupon table

Apply: `node scripts/apply-linked-migrations.js <files…>`

## Phase 2 (not built)

Public `/teachers` directory, featured Pro classes, express-interest gating, teacher profile popover, sponsor-student-subscription, chapter weak-area analytics UI.

## Verification

- `npx vitest run lib/teacherPortal/teacherPlan.test.ts` — 9/9 pass
- Free teacher: `/api/teacher/live-classes/book` → 403 `live_class_cap_reached`
- Paid checkout sets `teacher_plan_tier` + `teacher_plan_expires_at`
- Ended booked slot → delivery grant → rateable → quality bonus (credit-only) when gates pass
