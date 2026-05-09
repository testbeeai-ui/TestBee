import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

type RpcRow = { subject: string; avg_pct: number | null; paper_count: number | null };

/** GET — catalog mock % averages per PCM subject (latest attempt per paper). */
export async function GET(request: Request) {
  const auth = await getSupabaseAndUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await (
    auth.supabase as unknown as {
      rpc: (fn: string) => Promise<{ data: RpcRow[] | null; error: { message: string } | null }>;
    }
  ).rpc("get_user_mock_subject_score_averages");

  if (error) {
    console.error("[mock-subject-averages]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const base = {
    physics: { avg: null as number | null, count: 0 },
    chemistry: { avg: null as number | null, count: 0 },
    math: { avg: null as number | null, count: 0 },
  };

  for (const row of data ?? []) {
    const sub = (row.subject || "").toLowerCase().trim();
    if (sub === "physics" || sub === "chemistry" || sub === "math") {
      const avgRaw = row.avg_pct;
      const cntRaw = row.paper_count;
      const avg =
        typeof avgRaw === "number" && Number.isFinite(avgRaw)
          ? avgRaw
          : avgRaw != null && String(avgRaw).length > 0
            ? Number(avgRaw)
            : NaN;
      const cnt =
        typeof cntRaw === "number" && Number.isFinite(cntRaw)
          ? cntRaw
          : cntRaw != null && String(cntRaw).length > 0
            ? Number(cntRaw)
            : 0;
      base[sub] = {
        avg: Number.isFinite(avg) ? Math.round(avg) : null,
        count: Number.isFinite(cnt) ? Math.max(0, Math.trunc(cnt)) : 0,
      };
    }
  }

  return NextResponse.json({ subjects: base });
}
