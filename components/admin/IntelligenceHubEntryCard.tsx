"use client";

import Link from "next/link";
import { ChevronRight, LineChart } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { INTELLIGENCE_HUB_PATH } from "@/lib/admin/intelligenceReports";

export function IntelligenceHubEntryCard() {
  return (
    <Link href={INTELLIGENCE_HUB_PATH} className="block h-full">
      <Card
        size="sm"
        className="h-full border-primary/25 bg-primary/5 transition-colors hover:border-primary/45 hover:bg-primary/10"
      >
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-medium text-primary">
              <LineChart className="h-3.5 w-3.5" />
              Growth Intelligence
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
              Open
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </CardDescription>
          <CardTitle className="text-lg font-bold leading-snug">6 deep-dive reports</CardTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Retention, funnel, drop-off, adoption, churn risk, and errors
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}
