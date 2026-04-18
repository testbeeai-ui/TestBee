"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/safeSession";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Bot, RefreshCw, PlayCircle } from "lucide-react";
import { getStudentPersonaByIndex } from "@/lib/gyanBotPersonas";

type BotConfig = {
  active: boolean;
  interval_minutes: number;
  current_student_index: number;
  last_post_at: string | null;
  /** Monotonic-ish pointer into the persona-filtered curriculum pool */
  curriculum_sequence_index?: number;
  /** 1–5; slot 5 forces a numerical / exam-setup style doubt */
  curriculum_batch_slot?: number;
};

type BotCapabilities = {
  sarvamConfigured: boolean;
  ragSidecarConfigured: boolean;
  ragInternalTokenSet: boolean;
  cronSecretConfigured: boolean;
  serviceRoleConfigured: boolean;
  vercelProduction: boolean;
};

export default function GyanBotAdminPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [intervalDraft, setIntervalDraft] = useState("10");
  const [capabilities, setCapabilities] = useState<BotCapabilities | null>(null);
  const [setupWarnings, setSetupWarnings] = useState<string[]>([]);

  const displayNextStudent = useMemo(() => {
    if (!config) return null;
    const idx = Number(config.current_student_index) || 0;
    const p = getStudentPersonaByIndex(idx);
    return { name: p.name, index: idx, subjectFocus: p.subjectFocus };
  }, [config]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/admin/gyan-bot", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      const body = (await res.json()) as {
        config?: BotConfig;
        nextStudent?: { name: string; index: number; subjectFocus: string };
        capabilities?: BotCapabilities;
        warnings?: string[];
        error?: string;
        hint?: string;
        code?: string;
      };
      if (!res.ok) {
        const msg = [body.error, body.hint].filter(Boolean).join(" — ");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      if (body.config) {
        setConfig(body.config);
        setIntervalDraft(String(body.config.interval_minutes ?? 10));
      }
      setCapabilities(body.capabilities ?? null);
      setSetupWarnings(Array.isArray(body.warnings) ? body.warnings : []);
    } catch (e) {
      toast({
        title: "Could not load bot config",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const authHeaders = async () => {
    const { session } = await safeGetSession();
    if (!session?.access_token) throw new Error("Not signed in");
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const setActive = async (active: boolean) => {
    setSaving(true);
    try {
      const h = await authHeaders();
      const res = await fetch("/api/admin/gyan-bot", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const body = (await res.json()) as { config?: BotConfig; error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.config) setConfig(body.config);
      toast({ title: active ? "Gyan bot started" : "Gyan bot stopped" });
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveInterval = async () => {
    const n = Number(intervalDraft);
    if (!Number.isFinite(n) || n < 1 || n > 1440) {
      toast({ title: "Interval must be 1–1440 minutes", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const h = await authHeaders();
      const res = await fetch("/api/admin/gyan-bot", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ interval_minutes: Math.floor(n) }),
      });
      const body = (await res.json()) as { config?: BotConfig; error?: string };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.config) setConfig(body.config);
      toast({ title: "Interval saved" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const runOneCycle = async () => {
    setSaving(true);
    try {
      const h = await authHeaders();
      const res = await fetch("/api/admin/gyan-bot", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ run_one_cycle: true }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        cycle?: { skipped?: boolean; reason?: string; doubtId?: string; error?: string };
        config?: BotConfig;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.config) {
        setConfig(body.config);
        setIntervalDraft(String(body.config.interval_minutes ?? 10));
      }
      const c = body.cycle;
      if (c?.skipped) {
        toast({ title: "No post created", description: c.reason ?? "Skipped" });
      } else if (c?.doubtId) {
        toast({ title: "Bot post created", description: `Doubt ${c.doubtId.slice(0, 8)}… — refresh the feed to see it.` });
      }
      void load();
    } catch (e) {
      toast({
        title: "Run cycle failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const seedPersonas = async () => {
    setSeeding(true);
    try {
      const h = await authHeaders();
      const res = await fetch("/api/admin/seed-gyan-bot-personas", {
        method: "POST",
        headers: { ...h },
      });
      const body = (await res.json()) as { ok?: boolean; error?: string; created?: string[]; skippedExistingEmail?: string[] };
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      toast({
        title: "Bot personas",
        description: `Created: ${body.created?.length ?? 0}, already existed: ${body.skippedExistingEmail?.length ?? 0}`,
      });
    } catch (e) {
      toast({
        title: "Seed failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="edu-card rounded-2xl p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading bot admin…
      </div>
    );
  }

  return (
    <div className="edu-card rounded-2xl p-4 sm:p-5 border border-primary/20 bg-primary/5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-bold text-sm sm:text-base">Gyan++ bot orchestration</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rotates 12 student personas; Prof-Pi answers each post. In production, Vercel cron calls the poster every 10
              min. On your PC, cron does not run — use <strong>Run one post now</strong> to test.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {config && (
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase">Status</dt>
            <dd className="font-bold">{config.active ? "Running" : "Stopped"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase">Interval</dt>
            <dd className="font-bold">{config.interval_minutes} min</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase">Next student</dt>
            <dd className="font-bold">
              {displayNextStudent
                ? `${displayNextStudent.name} (#${displayNextStudent.index}) — ${displayNextStudent.subjectFocus}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase">Last bot post</dt>
            <dd className="font-bold">
              {config.last_post_at ? new Date(config.last_post_at).toLocaleString() : "Never"}
              {!config.last_post_at ? (
                <span className="block text-[11px] text-muted-foreground font-normal mt-1">
                  Tracks this orchestrator only (not old showcase / manual posts).
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-semibold uppercase">Curriculum pointer</dt>
            <dd className="font-bold">
              seq #{config.curriculum_sequence_index ?? 0}
              <span className="text-muted-foreground font-normal"> · </span>
              batch slot {config.curriculum_batch_slot ?? 1}/5
              <span className="block text-[11px] text-muted-foreground font-normal mt-1">
                Slot 5 = numeric round. Dedupe by cell in <code className="text-[10px]">gyan_curriculum_nodes</code> +{" "}
                <code className="text-[10px]">doubts.gyan_curriculum_node_id</code>.
              </span>
            </dd>
          </div>
        </dl>
      )}

      {capabilities ? (
        <div className="mt-4 rounded-xl border border-border/80 bg-background/60 px-3 py-2.5 space-y-2">
          <p className="text-xs font-bold text-foreground">Server readiness (this deployment)</p>
          <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
            <span className={capabilities.serviceRoleConfigured ? "rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5" : "rounded-full bg-amber-500/20 text-amber-800 px-2 py-0.5"}>
              Service role {capabilities.serviceRoleConfigured ? "OK" : "missing"}
            </span>
            <span className={capabilities.sarvamConfigured ? "rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5" : "rounded-full bg-amber-500/20 text-amber-800 px-2 py-0.5"}>
              Sarvam {capabilities.sarvamConfigured ? "OK" : "missing"}
            </span>
            <span className={capabilities.ragSidecarConfigured ? "rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5" : "rounded-full bg-muted text-muted-foreground px-2 py-0.5"}>
              RAG sidecar {capabilities.ragSidecarConfigured ? "OK" : "off"}
            </span>
            <span className={capabilities.cronSecretConfigured ? "rounded-full bg-emerald-500/15 text-emerald-700 px-2 py-0.5" : "rounded-full bg-muted text-muted-foreground px-2 py-0.5"}>
              CRON_SECRET {capabilities.cronSecretConfigured ? "set" : "unset"}
            </span>
            {capabilities.vercelProduction ? (
              <span className="rounded-full bg-blue-500/15 text-blue-700 px-2 py-0.5">Vercel production</span>
            ) : null}
          </div>
          {setupWarnings.length > 0 ? (
            <ul className="text-[11px] text-amber-900 dark:text-amber-200/90 list-disc pl-4 space-y-1">
              {setupWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">No blocking setup warnings detected for this environment.</p>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">Post interval (minutes)</label>
          <div className="flex gap-1">
            <input
              type="number"
              min={1}
              max={1440}
              className="w-24 rounded-xl border border-input bg-background px-2 py-1.5 text-sm"
              value={intervalDraft}
              onChange={(e) => setIntervalDraft(e.target.value)}
            />
            <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={saving} onClick={() => void saveInterval()}>
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          className="rounded-xl"
          disabled={saving || config?.active}
          onClick={() => void setActive(true)}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Start bot
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="rounded-xl"
          disabled={saving || !config?.active}
          onClick={() => void setActive(false)}
        >
          Stop bot
        </Button>
        <Button type="button" variant="outline" className="rounded-xl" disabled={seeding} onClick={() => void seedPersonas()}>
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Seed bot users (13)
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl gap-1 border-primary/40"
          disabled={saving || !config?.active}
          onClick={() => void runOneCycle()}
          title="Bypasses the interval timer once (local testing). Bot must be Running."
        >
          <PlayCircle className="h-4 w-4" />
          Run one post now
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        One-time: <strong>Seed bot users</strong> creates auth + profiles for fixed UUIDs (Prof-Pi + 12 students). Set{" "}
        <code className="text-[10px] bg-muted px-1 rounded">GYAN_BOT_SEED_PASSWORD</code> in production.
      </p>
    </div>
  );
}
