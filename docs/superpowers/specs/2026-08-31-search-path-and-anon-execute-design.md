# Pin search_path and revoke anon EXECUTE on SECURITY DEFINER

**Status:** Approved (Approach 1)  
**Product:** TestBee production database (`bytsiknhtcnlxwzgqkrd`), schema owned from `Web/supabase`  
**Date:** 2026-08-31

## Goal

Clear two Supabase security-advisor classes without breaking signed-in RPCs or the two logged-out lookup flows:

1. **0011 `function_search_path_mutable`** — public functions with no fixed `search_path`.
2. **0028 `anon_security_definer_function_executable`** — `SECURITY DEFINER` functions the `anon` role can hit at `/rest/v1/rpc/...`.

After this ships, a logged-out client must not be able to execute privileged definer functions such as `add_rdm`, `deduct_rdm`, or `admin_*`. Classroom join preview and EduDeca referral preview must still work before sign-in.

## Problem

Postgres grants `EXECUTE` on new functions to `PUBLIC` by default. `anon` inherits that. PostgREST then exposes every `public` function as RPC. Many of those functions are `SECURITY DEFINER` (they run as the owner and bypass RLS). Combined with a mutable `search_path`, a caller who can create objects in a writable schema can hijack unqualified names inside the function.

Newer Web migrations already `REVOKE … FROM PUBLIC` and `SET search_path` on some functions. Recreates, older functions, and default `PUBLIC` grants mean the advisor still reports both classes.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Advisor classes 0011 + 0028 only |
| Search path value | `public, pg_temp` via `ALTER FUNCTION … SET search_path` (no body rewrites) |
| Search path coverage | Catalog-driven: every `public` function whose `proconfig` does not already set `search_path` |
| EXECUTE revoke coverage | Catalog-driven: every `public` `SECURITY DEFINER` function |
| Anon RPC allow-list | `lookup_classroom_by_join_code(text)`, `lookup_edudeca_referrer_preview(text)` only |
| RLS helper exception | Keep `anon` EXECUTE on definer functions that anon-facing RLS policies actually call (today: `edubite_is_content_admin()`) |
| Authenticated / service_role | Preserve existing grants. After `REVOKE FROM PUBLIC`, re-grant a role only if it could already execute the function (including via `PUBLIC`). Do not newly grant `authenticated` on service-role-only helpers |
| Default privileges | Out of scope. New functions must `REVOKE FROM PUBLIC` in their own migration |
| Extensions in `public`, always-true RLS, storage listing, 0029, leaked-password Auth flag | Separate specs |

## Non-goals

- Revoking `authenticated` EXECUTE on client RPCs (advisor 0029). Signed-in users are supposed to call `claim_*`, `record_play_result`, and similar.
- Moving functions into a private schema.
- Switching definer functions to `SECURITY INVOKER`.
- `SET search_path = ''` or rewriting function bodies to fully qualify names.
- Moving `pg_trgm` / `vector` out of `public`.
- Changing RLS policy expressions other than grants needed so existing policies still evaluate.
- Enabling Auth leaked-password protection (dashboard, not SQL).
- Changing EduBite / EduDeca app code. Behavior stays the same; only privileges and `search_path` change on TestBee.

## Architecture

One new Web migration, applied to TestBee. Two catalog loops, no per-function `CREATE OR REPLACE`.

```
pg_proc (public)
        │
        ├─ missing search_path  → ALTER FUNCTION … SET search_path = public, pg_temp
        │
        └─ SECURITY DEFINER
                │
                ├─ snapshot: could `authenticated` / `service_role` execute? (includes PUBLIC)
                ├─ REVOKE EXECUTE FROM PUBLIC, anon
                ├─ if authenticated could execute → GRANT EXECUTE TO authenticated
                ├─ if service_role could execute → GRANT EXECUTE TO service_role
                ├─ if name+signature is allow-listed → GRANT EXECUTE TO anon
                └─ if referenced by an RLS policy whose roles include anon
                      GRANT EXECUTE TO anon
```

PostgREST keeps using the `public` schema. Trigger functions still fire: `EXECUTE` is not required of the inserting role when a trigger runs. Helper functions used inside other definer functions are invoked as the owner, so they do not need `anon` EXECUTE.

### Why re-grant `authenticated` only when it already had EXECUTE

`REVOKE FROM PUBLIC` removes the implicit grant that both `anon` and `authenticated` were using. If the migration revoked and did not restore `authenticated` on functions that only had `PUBLIC`, signed-in RPC calls would fail with permission denied.

Snapshot `has_function_privilege` **before** the revoke. Re-grant `authenticated` / `service_role` only when that snapshot was true. Functions that already `REVOKE`d `authenticated` and granted only `service_role` (for example `allocate_student_code`) stay that way. Tightening 0029 further is a later spec.

## Components

### 1. Search-path pin

`ALTER FUNCTION <oid::regprocedure> SET search_path TO 'public', 'pg_temp'`.

- Matches existing Web/EduDeca style (`SET search_path TO 'public', 'pg_temp'`).
- `public` first, `pg_temp` last, so temp objects cannot shadow public names.
- Skip functions that already have a `search_path` entry in `proconfig` (do not overwrite a tighter setting).
- Include the 22 names in the 2026-08-31 advisor dump; the catalog loop will also catch any extra public functions missing the setting.

Do not change function bodies. Unqualified names keep resolving to `public`.

### 2. Anon EXECUTE revoke

For each `public` function with `prosecdef = true`:

1. Snapshot whether `authenticated` and `service_role` can execute (this is true when `PUBLIC` still has the grant).
2. `REVOKE ALL ON FUNCTION … FROM PUBLIC`.
3. `REVOKE ALL ON FUNCTION … FROM anon`.
4. If the snapshot said `authenticated` could execute: `GRANT EXECUTE … TO authenticated`.
5. If the snapshot said `service_role` could execute: `GRANT EXECUTE … TO service_role`.
6. `GRANT EXECUTE … TO anon` only if the function is on the RPC allow-list or is an RLS helper (below).

Use `oid::regprocedure` so overloads (`accept_buddy_invite`, `submit_daily_gauntlet`, …) are each handled.

Drop the leftover `GRANT EXECUTE ON FUNCTION public.submit_daily_gauntlet(date, jsonb) TO anon` from the 2026-05 lint follow-up. Gauntlet is a signed-in flow.

### 3. RPC allow-list (logged-out clients)

| Function | Why `anon` must keep EXECUTE |
|----------|------------------------------|
| `public.lookup_classroom_by_join_code(text)` | `/join` and `GET /api/join/lookup` run with the user session, often before sign-in |
| `public.lookup_edudeca_referrer_preview(text)` | EduDeca referral landing uses the cookie session, often before sign-in |

No other definer RPC is granted to `anon` by this migration.

### 4. RLS helper exception

Postgres checks `EXECUTE` on functions called from RLS expressions for the current role. EduBite catalog `SELECT` policies apply to `anon` and call `public.edubite_is_content_admin()`. Revoking that would 500 public catalog reads even when `published = true`.

Detect helpers at migration time: any `public` `SECURITY DEFINER` function whose name appears in `pg_policy.qual` or `pg_policy.with_check` for a policy whose roles include `anon` (or `public`). Grant `anon` EXECUTE on those only.

Expected hit today: `edubite_is_content_admin()`. Residual advisor 0028 on that function is accepted. Do not rewrite EduBite policies in this spec.

`edudeca_is_college_admin()` is granted to `authenticated` only and is not an anon RLS helper.

## Data flow

No table or payload changes. Privilege change only:

1. Logged-out PostgREST RPC → `anon` → succeeds only for the two lookups (and would still evaluate RLS helpers during table `SELECT`, which is not RPC).
2. Signed-in PostgREST RPC → `authenticated` → same set of definer RPCs as today.
3. Triggers / `SECURITY DEFINER` internals → owner → unchanged.

## Error handling

- Migration is idempotent: re-run of the same `ALTER` / `REVOKE` / `GRANT` is a no-op.
- If a function is dropped later, nothing in this migration is re-applied automatically. New definer functions in later migrations must `REVOKE FROM PUBLIC` themselves (existing Web convention).
- Rollback: restore `GRANT EXECUTE TO PUBLIC` on the affected functions. Prefer a forward migration over editing this one after apply.

## Testing

1. **Advisor (required).** After apply, `get_advisors` / `supabase db advisors` security:
   - 0011: none of the previously listed public functions remain (no `function_search_path_mutable` for them).
   - 0028: gone for `add_rdm`, `deduct_rdm`, `admin_*`, `claim_*`, trigger wrappers, etc.
   - 0028 may remain for `edubite_is_content_admin` and the two allow-listed lookups. That is expected.
   - 0029 unchanged (out of scope).

2. **Privilege SQL.** Assert `has_function_privilege('anon', 'public.add_rdm(uuid, integer)', 'execute')` is false. Assert it is true for the two lookups. Assert `has_function_privilege('authenticated', 'public.add_rdm(uuid, integer)', 'execute')` remains true.

3. **Smoke (manual / browser substitute).**
   - Logged out: `/join?code=…` still returns a classroom preview.
   - Logged out: EduDeca referral pending route still returns a referrer name.
   - Logged out: PostgREST `POST /rest/v1/rpc/add_rdm` returns permission denied / 401-class failure, not a balance change.
   - Logged in: one existing claim or play RPC still succeeds (no grant regression).
   - Logged out: EduBite published inspiration/catalog `SELECT` still works.

4. **Do not** add app unit tests for SQL grants. Verification is advisor + SQL assertions in the migration comments or a small `supabase db query` checklist in the implementation plan.

## Implementation placement

- Create the file with `supabase migration new` from `Web/` (CLI required; do not invent the timestamp).
- Path: `Web/supabase/migrations/<timestamp>_pin_search_path_revoke_anon_definer.sql`.
- Apply to TestBee (`bytsiknhtcnlxwzgqkrd`), not TestBee RAG.
- Do not duplicate this migration under EduBite or EduDeca. Those folders are not the TestBee migration history for this database.

## Success criteria

- Advisor 0011 cleared for public functions that lacked `search_path`.
- Advisor 0028 cleared except allow-listed lookups and documented RLS helpers.
- Join-by-code and EduDeca referrer preview still work while logged out.
- Signed-in RPCs keep `EXECUTE`.
- No function body or RLS expression rewrites.
