"use client";

import Link from "next/link";
import { ChevronRight, LineChart } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { INTELLIGENCE_REPORTS, intelligenceReportHref } from "@/lib/admin/intelligenceReports";

export default function IntelligenceHubPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <LineChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Growth Intelligence</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Retention, funnel, drop-off, adoption, churn risk, and error monitoring — opened from
              the Overview dashboard beside AI Calls.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {INTELLIGENCE_REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.slug} href={intelligenceReportHref(report.slug)} className="group">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-base">{report.label}</CardTitle>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
