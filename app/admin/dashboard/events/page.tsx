"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { safeGetSession } from "@/lib/auth/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type EventRow = {
  event_name: string;
  event_count: number;
  unique_users: number;
  pct_of_total: number;
};

type EventSummary = {
  periodDays: number;
  totalEvents: number;
  uniqueUsers: number;
  events: EventRow[];
  generatedAt: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default function EventsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<EventSummary | null>(null);
  const [days, setDays] = useState(30);

  const load = async (d: number) => {
    setLoading(true);
    setError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const res = await fetch(`/api/admin/analytics/events?days=${d}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as EventSummary & { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
  }, [days]);

  const topEvents = data?.events?.slice(0, 20) ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Student Events</CardTitle>
              <CardDescription>
                Unified event stream — every student action tracked in one place
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {[7, 30, 90].map((d) => (
                <Button
                  key={d}
                  variant={days === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDays(d)}
                >
                  {d}d
                </Button>
              ))}
              <Button variant="outline" onClick={() => load(days)} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Events</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {formatNumber(data.totalEvents)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Unique Users</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {formatNumber(data.uniqueUsers)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Event Types</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {formatNumber(data.events.length)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Events by Volume</CardTitle>
                <CardDescription>Horizontal bar = event count</CardDescription>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topEvents.slice(0, 15)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="event_name" width={180} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "event_count") return [formatNumber(Number(value)), "Events"];
                        return [formatNumber(Number(value)), "Users"];
                      }}
                    />
                    <Bar dataKey="event_count" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Breakdown</CardTitle>
                <CardDescription>All events with counts and unique users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {data.events.map((ev) => (
                    <div
                      key={ev.event_name}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {ev.event_name}
                        </code>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {formatNumber(ev.unique_users)} users
                        </span>
                        <Badge variant="secondary">{formatNumber(ev.event_count)} events</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
