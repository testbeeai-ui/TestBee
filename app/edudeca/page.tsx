import { Suspense } from "react";

import EduDecaPageClient from "./EduDecaPageClient";
import { MarketingPageFallback } from "@/components/landing/PublicMarketingShell";

export default function EduDecaPage() {
  return (
    <Suspense fallback={<MarketingPageFallback />}>
      <EduDecaPageClient />
    </Suspense>
  );
}
