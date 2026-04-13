import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient, normalizeServiceRoleKey } from "@/integrations/supabase/server";
import { runProfPiAnswerForDoubt, waitForDoubtRow } from "@/lib/gyanBotAnswer";

/** Prof-Pi runs RAG (Modal) + Sarvam + optional verifier — default Vercel timeout is too low. */
export const maxDuration = 120;

const DOUBT_ID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Trigger ProfPi answer for a doubt (similarity → Sarvam+RAG rephrase, else Sarvam+RAG full answer).
 * Auth: Bearer CRON_SECRET, or doubt author, or admin.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { doubtId?: string };
    const doubtId = typeof body.doubtId === "string" ? body.doubtId.trim() : "";
    if (!doubtId) {
      return NextResponse.json({ error: "doubtId required" }, { status: 400 });
    }
    if (!DOUBT_ID_UUID_RE.test(doubtId)) {
      return NextResponse.json(
        { error: "Invalid doubtId", hint: "Expected a UUID from create_doubt_with_escrow." },
        { status: 400 },
      );
    }

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });

    let allowed = false;

    if (cronSecret && bearer === cronSecret) {
      allowed = true;
    } else {
      const ctx = await getSupabaseAndUser(req);
      if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { data: gateRow, error: gateSelectError } = await waitForDoubtRow(admin, doubtId, "user_id");
      const doubt = gateRow as { user_id: string } | null;
      if (!doubt) {
        let supabaseHost = "";
        try {
          supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid").hostname;
        } catch {
          supabaseHost = "(invalid URL)";
        }
        console.error("[gyan-bot-answer] Doubt not found after retries", {
          doubtId,
          supabaseHost,
          hasNormalizedServiceRoleKey: Boolean(normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY)),
          /** If set, PostgREST failed (key/table/network) — not the same as “row missing”. */
          supabaseSelectError: gateSelectError?.message ?? null,
        });
        const errMsg = gateSelectError?.message ?? "";
        const invalidKey = /invalid api key/i.test(errMsg);
        const hint = gateSelectError?.message
          ? invalidKey
            ? "Invalid API key: the service_role JWT must be from the SAME Supabase project as NEXT_PUBLIC_SUPABASE_URL (copy both from Settings → API). On Vercel remove any wrapping quotes/spaces. Check Production (not only Preview) is selected for the variable."
            : "Supabase returned an error while loading the doubt. Fix keys/schema/network if this persists."
          : "If env vars match one project: check Preview vs Production env on Vercel, redeploy after changing NEXT_PUBLIC_*, confirm migrations ran on this DB (doubts table), and that the request doubtId matches the RPC id (Network → gyan-bot-answer payload).";
        return NextResponse.json(
          {
            error: "Doubt not found",
            hint,
            ...(gateSelectError?.message ? { supabaseError: gateSelectError.message } : {}),
          },
          { status: 404 },
        );
      }

      if (doubt.user_id === ctx.user.id) allowed = true;
      else if (await isAdminUser(ctx.supabase, ctx.user.id)) allowed = true;
    }

    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await runProfPiAnswerForDoubt(admin, doubtId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[gyan-bot-answer]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
