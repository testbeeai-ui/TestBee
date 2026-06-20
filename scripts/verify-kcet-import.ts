/**
 * Verify KCET past_papers import counts.
 *   npx tsx --env-file-if-exists=.env scripts/verify-kcet-import.ts
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const sb = createClient(url, key);
  const { data: papers, error } = await sb
    .from("past_papers")
    .select("id, exam_set_name, question_count, total_marks, duration_minutes, marking_scheme")
    .eq("exam_name", "KCET")
    .order("exam_set_name");
  if (error) throw error;

  let totalQ = 0;
  let mismatches = 0;
  for (const p of papers ?? []) {
    const { count, error: countErr } = await sb
      .from("past_paper_questions")
      .select("*", { count: "exact", head: true })
      .eq("paper_id", p.id);
    if (countErr) throw countErr;
    const ok = count === p.question_count;
    if (!ok) mismatches++;
    console.log(
      ok ? "OK" : "MISMATCH",
      String(p.exam_set_name).padEnd(14),
      "count=",
      p.question_count,
      "actual=",
      count,
      "marks=",
      p.total_marks,
      "dur=",
      p.duration_minutes
    );
    totalQ += count ?? 0;
  }
  console.log("---");
  console.log("papers:", papers?.length, "total questions:", totalQ, "mismatches:", mismatches);

  const scheme = papers?.[0]?.marking_scheme ?? "";
  const kcetSchemeOk = scheme.includes("+1 per correct") && scheme.includes("KCET");
  console.log("marking_scheme sample OK:", kcetSchemeOk, scheme.slice(0, 80));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
