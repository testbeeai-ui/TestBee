# Reset a test Google user (Edublast)

Deleting the person in **Authentication → Users** is not a full reset. The same Gmail can still be a teacher because access is stored by **email**.

## Required

1. **Authentication → Users** — delete the user.
2. **`approved_emails`** — find that Gmail. Delete the row, or change `role` to `student`.  
   Admin: `/admin` approved-emails list.

Without step 2, Welcome back still lets them in. They now see the Student / Teacher picker; saving as Teacher still needs a teacher whitelist row.

## Usually leftover (old user id)

These rows do not log them in again, but they clutter the DB:

- `public.profiles` (often removed with Auth if ON DELETE CASCADE)
- `public.user_roles`
- EduDeca: `edudeca_profiles`, `edudeca_user_progress`
- EduBite tables keyed by `user_id`

## Then sign in

Use **`/preview`** → Welcome back → Continue with Google. You should get **Who are you?**, not Teacher Profile.

To open teacher setup on purpose: Sign up → Teacher → Google.
