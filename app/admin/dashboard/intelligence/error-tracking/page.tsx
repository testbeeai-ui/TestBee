"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ErrorTrackingPage() {
  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const isConfigured = Boolean(sentryDsn);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Error Tracking</CardTitle>
              <CardDescription>Production error monitoring powered by Sentry</CardDescription>
            </div>
            <Badge variant={isConfigured ? "default" : "destructive"}>
              {isConfigured ? "Connected" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {isConfigured ? (
        <Card>
          <CardHeader>
            <CardTitle>Sentry Dashboard</CardTitle>
            <CardDescription>
              View detailed error reports, performance traces, and replay sessions in Sentry
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sentry is configured and actively capturing errors. For detailed error analysis, stack
              traces, and session replays, use the Sentry web dashboard.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-1">What&apos;s captured</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>- Unhandled JavaScript errors</li>
                  <li>- API route errors</li>
                  <li>- Performance traces (10% sample)</li>
                  <li>- Session replays on errors</li>
                </ul>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-1">Configuration</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>- DSN: {sentryDsn ? "Set" : "Missing"}</li>
                  <li>- Traces sample rate: 10%</li>
                  <li>- Replay on error: 100%</li>
                  <li>- Source maps: Hidden from client</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              To view errors, log in to your Sentry organization dashboard. Set SENTRY_ORG and
              SENTRY_PROJECT env vars for source map uploads.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>Configure Sentry to start capturing production errors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium mb-2">Steps to enable:</p>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  Create a project at <span className="font-mono text-foreground">sentry.io</span>
                </li>
                <li>Copy the DSN from Project Settings → Client Keys</li>
                <li>
                  Add to your <span className="font-mono text-foreground">.env.local</span>:
                  <pre className="mt-1 rounded bg-background p-2 text-xs">
                    {`NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/yyy
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your-auth-token`}
                  </pre>
                </li>
                <li>Restart the dev server — errors will start appearing in Sentry</li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground">
              Add <span className="font-mono text-foreground">@sentry/nextjs</span> and an{" "}
              <span className="font-mono text-foreground">instrumentation.ts</span> when you are
              ready to wire up capture (see Sentry&apos;s Next.js manual setup).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
