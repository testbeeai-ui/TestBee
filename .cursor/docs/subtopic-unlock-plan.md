# Concept Focus — teacher-funded subtopic unlock

## Product model

| Charge | Who pays | Who receives |
|--------|----------|--------------|
| **Subtopic unlock** | Teacher: **10 RDM × N** at publish (Concept Focus only; replaces flat publish fee) | Unlocks full subtopic for those N students only |
| **Completion reward (optional)** | Teacher escrow: **reward × N** at publish | **Each student** gets their slice when **they** complete before due date |
| **Teacher on completion** | — | **No RDM**; unused reward slots **refunded** after deadline |

**Done rule (Concept Focus):** `concept-focus-subtopic` task progress row **or** `subtopic_engagement.lessonChecklistMarkedCompleteAt`.

## Implementation

| Layer | Path |
|-------|------|
| Migration | `supabase/migrations/20260628150000_classroom_subtopic_unlock_grants.sql` |
| Server | `lib/teacherPortal/subtopicUnlockRdm.ts` |
| Create API | `app/api/teacher/assignments/create/route.ts` — `confirmSubtopicUnlock`, 428 if missing |
| Student check | `GET /api/classroom/[id]/posts/[postId]/subtopic-unlock` |
| Task gate | `app/api/classroom/[id]/posts/[postId]/task-progress` — `concept-focus-subtopic` requires active grant |
| Teacher UI | `CreateAssignmentWizard`, `MyClassroomView`, `AssignmentCompletionEscrowConfirm` |
| Student UI | Topic lesson page — `sponsoredFullSubtopic` in `topicQuestionBankAccess.ts` |

## Student access when unlocked

- All quiz sets 2–6 (not just one assigned set)
- Video & reading references
- Banner: `TEACHER_SPONSORED_SUBTOPIC_UNLOCK_MESSAGE`

Free-plan students without a grant still get **one assigned set only** (chapter quiz path).

## Prod migrations (TestBee `bytsiknhtcnlxwzgqkrd`)

Applied 2026-06-28:

- `classroom_assignment_completion_rdm_grants` (`20260628120100`)
- `classroom_subtopic_unlock_grants` (`20260628150000`)

## Backfill

Existing Concept Focus posts published before this feature have **no unlock grants**. Teacher must republish (with confirm) or insert grants manually for testing.
