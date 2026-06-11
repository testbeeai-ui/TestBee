# Step 1: Supabase custom domain for Google OAuth (`auth.edublast.in`)

Replace `bytsiknhtcnlxwzgqkrd.supabase.co` on the Google “Choose an account” screen with your brand domain.

**Project:** TestBee · `bytsiknhtcnlxwzgqkrd`  
**Custom hostname:** `auth.edublast.in`  
**Requires:** Supabase **Pro** (or higher) + Custom Domains add-on

---

## A. DNS (do this first — at your `edublast.in` registrar)

Add these records in the DNS panel for `edublast.in`:

| Type | Name / Host | Value | TTL |
|------|-------------|-------|-----|
| **CNAME** | `auth` | `bytsiknhtcnlxwzgqkrd.supabase.co` | 300 (or lowest) |

**Notes:**
- Some registrars want Host = `auth` only; others want `auth.edublast.in` — follow your provider’s UI.
- Trailing dot on the target is optional (`…supabase.co.` vs `…supabase.co`).
- Wait 5–30 minutes (sometimes up to a few hours) for propagation.

**Verify CNAME (optional):**

```powershell
nslookup -type=CNAME auth.edublast.in
```

You should see it pointing at `bytsiknhtcnlxwzgqkrd.supabase.co`.

---

## B. Register domain in Supabase (after CNAME resolves)

**Dashboard:** [Supabase](https://supabase.com/dashboard/project/bytsiknhtcnlxwzgqkrd/settings/general) → **General** → **Custom Domains** → add `auth.edublast.in`.

**Or CLI (from repo root):**

```powershell
npx supabase@latest domains create --project-ref bytsiknhtcnlxwzgqkrd --custom-hostname auth.edublast.in
```

CLI will return a **TXT** record for SSL (ACME), e.g.:

```
_acme-challenge.auth.edublast.in  TXT  <value-from-cli>
```

Add that TXT in DNS, then:

```powershell
npx supabase@latest domains reverify --project-ref bytsiknhtcnlxwzgqkrd
```

Repeat `reverify` until status is ready (DNS can be slow). SSL issuance may take up to ~30 minutes.

---

## C. Activate

When verification succeeds:

```powershell
npx supabase@latest domains activate --project-ref bytsiknhtcnlxwzgqkrd
```

Or use **Activate** in the Supabase dashboard.

After activation:
- Google OAuth will show **“continue to auth.edublast.in”** instead of `*.supabase.co`.
- Your app can keep `NEXT_PUBLIC_SUPABASE_URL=https://bytsiknhtcnlxwzgqkrd.supabase.co` — Supabase Auth uses the custom domain automatically.

---

## D. Google Cloud (required before testing OAuth)

In the **same** OAuth client used by Supabase Google provider, add redirect URI:

```
https://auth.edublast.in/auth/v1/callback
```

Keep the existing:

```
https://bytsiknhtcnlxwzgqkrd.supabase.co/auth/v1/callback
```

---

## E. Test

1. Clear browser data for `www.edublast.in`.
2. Open `https://www.edublast.in/preview-raknas-amu?mode=signin&role=student`
3. Sign in with Google — consent screen should say **auth.edublast.in**.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `failed to locate appropriate CNAME` | CNAME not added or not propagated yet — wait and retry `domains create` |
| Custom Domains greyed out | Upgrade to Pro + enable add-on in Billing |
| OAuth still shows supabase.co | Domain not **activated** yet, or browser cache — try incognito |
