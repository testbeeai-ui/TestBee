"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import type { DifficultyLevel } from "@/lib/slugs";

type LevelCoverage = {
  exists: boolean;
  hasOverviewProse: boolean;
  previewCount: number;
  gateViable: boolean;
};

type HubCoverageGroup = {
  board: string;
  subject: string;
  classLevel: number;
  topic: string;
  hubScope: string;
  levels: Record<DifficultyLevel, LevelCoverage>;
  missingGateLevels: DifficultyLevel[];
  anyRow: boolean;
  fullyGated: boolean;
};

type CoverageResponse = {
  groups?: HubCoverageGroup[];
  summary?: {
    totalGroups: number;
    fullyGated: number;
    partial: number;
    returned: number;
  };
  error?: string;
};

const LEVELS: DifficultyLevel[] = ["basics", "intermediate", "advanced"];

function levelBadge(level: LevelCoverage): string {
  if (!level.exists) return "missing";
  if (level.gateViable) return "ok";
  if (level.previewCount > 0) return "previews";
  return "empty";
}

function badgeClass(kind: string): string {
  if (kind === "ok") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (kind === "previews") return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
  if (kind === "empty") return "bg-muted text-muted-foreground";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
}

export default function TopicHubCoveragePage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ready" | "unauthorized" | "forbidden" | "error">("ready");
  const [errorMsg, setErrorMsg] = useState("");
  const [groups, setGroups] = useState<HubCoverageGroup[]>([]);
  const [summary, setSummary] = useState<CoverageResponse["summary"] | null>(null);

  const [board, setBoard] = useState("");
  const [subject, setSubject] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [hubScope, setHubScope] = useState("");
  const [topicSearch, setTopicSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      if (!user) {
        setStatus("unauthorized");
        return;
      }

      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleErr) throw roleErr;
      if (!roleRow) {
        setStatus("forbidden");
        return;
      }

      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const params = new URLSearchParams({ limit: "300" });
      if (board.trim()) params.set("board", board.trim());
      if (subject.trim()) params.set("subject", subject.trim());
      if (classLevel.trim()) params.set("classLevel", classLevel.trim());
      if (hubScope.trim()) params.set("hubScope", hubScope.trim());
      if (topicSearch.trim()) params.set("topic", topicSearch.trim());

      const res = await fetch(`/api/admin/topic-hub-coverage?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = (await res.json()) as CoverageResponse;
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);

      setGroups(Array.isArray(body.groups) ? body.groups : []);
      setSummary(body.summary ?? null);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to load coverage");
    } finally {
      setLoading(false);
    }
  }, [board, classLevel, hubScope, subject, topicSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCount = useMemo(() => groups.length, [groups]);

  if (status === "unauthorized") {
    return <p className="text-sm text-muted-foreground">Sign in as admin to view topic hub coverage.</p>;
  }
  if (status === "forbidden") {
    return <p className="text-sm text-muted-foreground">Admin access required.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Topic hub coverage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Per-topic/chapter rows across basics, intermediate, and advanced — gate viability for
          subtopic AI.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Board (CBSE)"
          value={board}
          onChange={(e) => setBoard(e.target.value)}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Class (11)"
          value={classLevel}
          onChange={(e) => setClassLevel(e.target.value)}
        />
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={hubScope}
          onChange={(e) => setHubScope(e.target.value)}
        >
          <option value="">All scopes</option>
          <option value="topic">topic</option>
          <option value="chapter">chapter</option>
        </select>
        <input
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Topic contains…"
          value={topicSearch}
          onChange={(e) => setTopicSearch(e.target.value)}
        />
      </div>

      {summary ? (
        <p className="text-xs text-muted-foreground">
          {summary.totalGroups} hub keys · {summary.fullyGated} fully gated · {summary.partial}{" "}
          partial · showing {filteredCount}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : status === "error" ? (
        <p className="text-sm text-destructive">{errorMsg}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Topic</th>
                <th className="px-3 py-2 font-semibold">Meta</th>
                {LEVELS.map((l) => (
                  <th key={l} className="px-3 py-2 font-semibold capitalize">
                    {l}
                  </th>
                ))}
                <th className="px-3 py-2 font-semibold">Missing gate</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={`${g.board}-${g.subject}-${g.classLevel}-${g.hubScope}-${g.topic}`} className="border-t border-border">
                  <td className="px-3 py-2 align-top max-w-[220px]">
                    <p className="font-medium break-words">{g.topic}</p>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground whitespace-nowrap">
                    {g.board} · {g.subject} · {g.classLevel}
                    <br />
                    scope: {g.hubScope}
                  </td>
                  {LEVELS.map((l) => {
                    const cov = g.levels[l];
                    const kind = levelBadge(cov);
                    return (
                      <td key={l} className="px-3 py-2 align-top">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass(kind)}`}
                        >
                          {kind}
                          {cov.previewCount > 0 ? ` · ${cov.previewCount}p` : ""}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 align-top text-xs">
                    {g.missingGateLevels.length === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">—</span>
                    ) : (
                      g.missingGateLevels.join(", ")
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">No rows match filters.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
