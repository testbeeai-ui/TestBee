"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INTELLIGENCE_HUB_PATH,
  INTELLIGENCE_REPORTS,
  intelligenceReportHref,
} from "@/lib/admin/intelligenceReports";

export function IntelligenceHubNav() {
  const pathname = usePathname();
  const onHub = pathname === INTELLIGENCE_HUB_PATH;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" asChild>
          <Link href="/admin/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Overview
          </Link>
        </Button>
        <div className="hidden h-4 w-px bg-border sm:block" aria-hidden />
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LineChart className="h-4 w-4 text-primary" />
          Growth Intelligence
        </div>
      </div>

      <nav
        className="flex flex-wrap gap-1 rounded-xl border bg-muted/30 p-1"
        aria-label="Growth intelligence reports"
      >
        <Link
          href={INTELLIGENCE_HUB_PATH}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            onHub
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
          )}
        >
          All reports
        </Link>
        {INTELLIGENCE_REPORTS.map((report) => {
          const href = intelligenceReportHref(report.slug);
          const active = pathname === href;
          const Icon = report.icon;
          return (
            <Link
              key={report.slug}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {report.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
