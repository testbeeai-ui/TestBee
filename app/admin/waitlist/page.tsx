"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminWaitlistRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", "waitlist");
    router.replace(`/admin/feedback?${sp.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-muted-foreground animate-pulse">Redirecting to F&W Inbox...</p>
    </div>
  );
}
