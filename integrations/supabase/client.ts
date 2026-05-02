"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local."
  );
}

/**
 * Cookie-backed session (via @supabase/ssr) so Edge middleware and the browser agree on auth.
 * A localStorage-only client caused: middleware 302 to `/?next=/home` while the client still had
 * a session → `router.replace("/home")` loop and hundreds of GETs.
 */
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // Disable Navigator LockManager — on some Windows/embedded browsers it can delay or break
    // persisting the code verifier before redirecting to Google.
    lock: async (_name, _acquireTimeout, fn) => {
      return await fn();
    },
  },
});
