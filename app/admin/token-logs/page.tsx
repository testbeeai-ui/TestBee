"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { safeGetSession } from "@/lib/safeSession";

function getErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const maybe = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [
      typeof maybe.message === "string" ? maybe.message : "",
      typeof maybe.details === "string" ? maybe.details : "",
      typeof maybe.hint === "string" ? `hint: ${maybe.hint}` : "",
      typeof maybe.code === "string" ? `code: ${maybe.code}` : "",
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" | ");
  }
  return "Unknown error";
}

export default function TokenLogsPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"ready" | "unauthorized" | "forbidden" | "error">("ready");
  const [errorMsg, setErrorMsg] = useState("");
  type TokenLogRow = Database["public"]["Tables"]["ai_token_logs"]["Row"];
  const [rows, setRows] = useState<TokenLogRow[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [backendFilter, setBackendFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          if (!cancelled) setStatus("unauthorized");
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
          if (!cancelled) setStatus("forbidden");
          return;
        }

        const { session } = await safeGetSession();
        if (!session?.access_token) throw new Error("Missing access token");

        const res = await fetch("/api/admin/token-logs?limit=1000", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const body = (await res.json()) as {
          rows?: TokenLogRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(body?.error || `Failed to load logs (${res.status})`);

        if (!cancelled) {
          setRows(Array.isArray(body.rows) ? body.rows : []);
          setStatus("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(getErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    const uniq = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort();
    return {
      actions: uniq(rows.map((r) => r.action_type)),
      models: uniq(rows.map((r) => r.model_id)),
      backends: uniq(rows.map((r) => r.backend)),
      users: uniq(rows.map((r) => r.user_id ?? "system")),
      months: uniq(rows.map((r) => new Date(r.created_at).toISOString().slice(0, 7))).reverse(),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const month = new Date(row.created_at).toISOString().slice(0, 7);
      if (actionFilter !== "all" && row.action_type !== actionFilter) return false;
      if (modelFilter !== "all" && row.model_id !== modelFilter) return false;
      if (backendFilter !== "all" && row.backend !== backendFilter) return false;
      if (userFilter !== "all" && (row.user_id ?? "system") !== userFilter) return false;
      if (monthFilter !== "all" && month !== monthFilter) return false;
      if (!q) return true;
      const hay = [
        row.action_type,
        row.model_id,
        row.backend,
        row.user_id ?? "system",
        String(
          (row.metadata as { telemetry?: { tokenSource?: string } } | null | undefined)?.telemetry
            ?.tokenSource ?? ""
        ),
        JSON.stringify(row.metadata ?? {}),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, actionFilter, modelFilter, backendFilter, userFilter, monthFilter]);

  const totals = useMemo(() => {
    const prompt = filteredRows.reduce((sum, row) => sum + Number(row.prompt_tokens ?? 0), 0);
    const output = filteredRows.reduce((sum, row) => sum + Number(row.candidates_tokens ?? 0), 0);
    const total = filteredRows.reduce((sum, row) => sum + Number(row.total_tokens ?? 0), 0);
    return { prompt, output, total };
  }, [filteredRows]);

  const monthlyStats = useMemo(() => {
    const byMonth = new Map<
      string,
      { entries: number; prompt: number; output: number; total: number }
    >();
    for (const row of filteredRows) {
      const month = new Date(row.created_at).toISOString().slice(0, 7);
      const cur = byMonth.get(month) ?? { entries: 0, prompt: 0, output: 0, total: 0 };
      cur.entries += 1;
      cur.prompt += Number(row.prompt_tokens ?? 0);
      cur.output += Number(row.candidates_tokens ?? 0);
      cur.total += Number(row.total_tokens ?? 0);
      byMonth.set(month, cur);
    }
    return Array.from(byMonth.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, stat]) => ({ month, ...stat }));
  }, [filteredRows]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthStats = useMemo(
    () =>
      monthlyStats.find((m) => m.month === currentMonth) ?? {
        month: currentMonth,
        entries: 0,
        prompt: 0,
        output: 0,
        total: 0,
      },
    [monthlyStats, currentMonth]
  );

  if (loading) {
    return <main className="p-6">Loading token logs...</main>;
  }
  if (status === "unauthorized") {
    return <main className="p-6">Unauthorized (please sign in first)</main>;
  }
  if (status === "forbidden") {
    return <main className="p-6">Forbidden (admin role required)</main>;
  }
  if (status === "error") {
    return <main className="p-6">Failed to load token logs: {errorMsg}</main>;
  }

  return (
    <main className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">AI Token Logs</h1>
        <p className="text-sm text-muted-foreground">
          Persistent telemetry for AI calls (model, tokens, backend, and metadata).
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded border p-3 text-sm"><p className="text-muted-foreground">Entries</p><p className="font-semibold">{filteredRows.length.toLocaleString()}</p></div>
        <div className="rounded border p-3 text-sm"><p className="text-muted-foreground">Prompt Tokens</p><p className="font-semibold">{totals.prompt.toLocaleString()}</p></div>
        <div className="rounded border p-3 text-sm"><p className="text-muted-foreground">Output Tokens</p><p className="font-semibold">{totals.output.toLocaleString()}</p></div>
        <div className="rounded border p-3 text-sm"><p className="text-muted-foreground">Total Tokens</p><p className="font-semibold">{totals.total.toLocaleString()}</p></div>
      </div>

      <div className="rounded border p-3 text-sm bg-muted/20">
        <p className="font-semibold">Current Month ({currentMonthStats.month})</p>
        <p className="text-muted-foreground">
          Entries: {currentMonthStats.entries.toLocaleString()} | Tokens: {currentMonthStats.total.toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input className="border rounded px-3 py-2 text-sm md:col-span-2" placeholder="Search action/model/user/metadata..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="border rounded px-2 py-2 text-sm" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="all">All actions</option>
          {options.actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="border rounded px-2 py-2 text-sm" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
          <option value="all">All models</option>
          {options.models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="border rounded px-2 py-2 text-sm" value={backendFilter} onChange={(e) => setBackendFilter(e.target.value)}>
          <option value="all">All backends</option>
          {options.backends.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="border rounded px-2 py-2 text-sm" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
          <option value="all">All months</option>
          {options.months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select className="border rounded px-2 py-2 text-sm" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
          <option value="all">All users</option>
          {options.users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          type="button"
          className="border rounded px-3 py-2 text-sm"
          onClick={() => {
            setSearch("");
            setActionFilter("all");
            setModelFilter("all");
            setBackendFilter("all");
            setUserFilter("all");
            setMonthFilter("all");
          }}
        >
          Clear filters
        </button>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <h2 className="text-sm font-semibold p-2 border-b bg-muted/30">Monthly Breakdown</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2 text-left">Month</th>
              <th className="p-2 text-right">Entries</th>
              <th className="p-2 text-right">Prompt</th>
              <th className="p-2 text-right">Output</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {monthlyStats.map((m) => (
              <tr key={m.month} className="border-t">
                <td className="p-2">{m.month}</td>
                <td className="p-2 text-right">{m.entries.toLocaleString()}</td>
                <td className="p-2 text-right">{m.prompt.toLocaleString()}</td>
                <td className="p-2 text-right">{m.output.toLocaleString()}</td>
                <td className="p-2 text-right">{m.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">Model</th>
              <th className="p-2 text-left">Backend</th>
              <th className="p-2 text-left">Token Source</th>
              <th className="p-2 text-right">Prompt</th>
              <th className="p-2 text-right">Output</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2 text-left">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                <td className="p-2 whitespace-nowrap">{row.user_id ?? "system"}</td>
                <td className="p-2 whitespace-nowrap">{row.action_type}</td>
                <td className="p-2 whitespace-nowrap">{row.model_id}</td>
                <td className="p-2 whitespace-nowrap">{row.backend}</td>
                <td className="p-2 whitespace-nowrap">
                  {(
                    (row.metadata as { telemetry?: { tokenSource?: string } } | null | undefined)
                      ?.telemetry?.tokenSource
                  ) ?? "legacy"}
                </td>
                <td className="p-2 text-right">{row.prompt_tokens.toLocaleString()}</td>
                <td className="p-2 text-right">{row.candidates_tokens.toLocaleString()}</td>
                <td className="p-2 text-right">{row.total_tokens.toLocaleString()}</td>
                <td className="p-2">
                  <details>
                    <summary className="cursor-pointer select-none">View</summary>
                    <pre className="mt-2 max-w-[640px] overflow-x-auto text-xs">
                      {JSON.stringify(row.metadata ?? {}, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
