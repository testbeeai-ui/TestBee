import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/integrations/supabase/types";

/**
 * Refreshes the Supabase session from cookies and returns a response that may
 * include updated Set-Cookie headers. Call `getUser()` on the client before
 * branching on auth — see Supabase SSR middleware docs.
 */
export function createSupabaseMiddleware(request: NextRequest): {
  supabase: ReturnType<typeof createServerClient<Database>>;
  getResponse: () => NextResponse;
} {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return {
    supabase,
    getResponse: () => response,
  };
}
