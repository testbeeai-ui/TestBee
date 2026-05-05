"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old URL: Play hub settings now live on RDM Table → Section → Play hub. */
export default function AdminPlayHubRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/rdm-table?tab=play");
  }, [router]);
  return (
    <main className="p-6 text-sm text-muted-foreground">
      Redirecting to RDM Table (Play hub section)…
    </main>
  );
}
