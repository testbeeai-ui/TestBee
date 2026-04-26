"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy URL: role is chosen on `/auth` (new account pane). */
function SelectRoleRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const mode = searchParams.get("mode") === "signin" ? "signin" : "signup";
    router.replace(`/auth?mode=${mode}`);
  }, [router, searchParams]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
      <span className="text-4xl animate-pulse">🎯</span>
    </div>
  );
}

export default function SelectRoleRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white">
          <span className="text-4xl animate-pulse">🎯</span>
        </div>
      }
    >
      <SelectRoleRedirectInner />
    </Suspense>
  );
}
