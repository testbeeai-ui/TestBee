"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local."
  );
}

// PKCE + localStorage. Disable Navigator LockManager — on some Windows/embedded browsers it can
// delay or break persisting the code verifier before redirecting to Google.
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    // Must return fn()'s result — otherwise _acquireLock yields undefined and
    // exchangeCodeForSession (PKCE) appears to return nothing.
    lock: async (_name, _acquireTimeout, fn) => {
      return await fn();
    },
  },
});
