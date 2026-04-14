import { NextResponse } from "next/server";
import { createClient, createClientWithToken } from "@/integrations/supabase/server";

const DEMO_DOUBTS = [
  {
    title: "How do I integrate x² eˣ by parts?",
    body: "I tried u = x² and dv = eˣ dx but the integral gets messy. What's the standard approach for ∫ x² eˣ dx?",
    subject: "Math",
  },
  {
    title: "Why does the normal force do no work when a block slides down an incline?",
    body: "My teacher said the normal force is perpendicular to displacement so work is zero. Can someone explain why we still need to consider it in FBD?",
    subject: "Physics",
  },
  {
    title: "Best way to balance a redox equation in acidic medium?",
    body: "I keep getting wrong coefficients for MnO₄⁻ + Fe²⁺ → Mn²⁺ + Fe³⁺. What are the half-reaction steps?",
    subject: "Chemistry",
  },
  {
    title: "Why does adding a small amount of strong acid to a buffer barely change the pH?",
    body: "I know Henderson–Hasselbalch says pH = pKa + log([A⁻]/[HA]). But intuitively why doesn't a drop of HCl crash the pH if it's strong acid?",
    subject: "Chemistry",
  },
];

const DEMO_ANSWERS_FIRST_DOUBT = [
  "Use integration by parts twice. Let u = x², dv = eˣ dx so du = 2x dx, v = eˣ. Then ∫ x² eˣ dx = x² eˣ − ∫ 2x eˣ dx. Apply by parts again on ∫ 2x eˣ dx with u = 2x, dv = eˣ dx. You'll get ∫ x² eˣ dx = eˣ (x² − 2x + 2) + C.",
  "Shortcut: for ∫ xⁿ eˣ dx keep differentiating xⁿ and integrate eˣ, alternating signs. So x² eˣ − 2x eˣ + 2eˣ + C. Same result!",
];

export async function POST(request: Request) {
  try {
    const cookieSupabase = await createClient();
    let user = (await cookieSupabase.auth.getUser()).data?.user ?? null;
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!user && token) {
      const { data: { user: u } } = await cookieSupabase.auth.getUser(token);
      user = u ?? null;
    }
    const supabase = user && token ? createClientWithToken(token) : cookieSupabase;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await supabase.from("doubts").select("id").eq("user_id", user.id).limit(1);
    if ((existing.data?.length ?? 0) > 0) {
      return NextResponse.json({ message: "You already have doubts; skip seeding.", seeded: false });
    }

    const inserted: string[] = [];
    for (const d of DEMO_DOUBTS) {
      const { data: row, error } = await supabase
        .from("doubts")
        .insert({ user_id: user.id, title: d.title, body: d.body, subject: d.subject })
        .select("id")
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (row?.id) inserted.push(row.id);
    }

    const firstDoubtId = inserted[0];
    if (firstDoubtId) {
      for (const body of DEMO_ANSWERS_FIRST_DOUBT) {
        const { data: ans, error } = await supabase
          .from("doubt_answers")
          .insert({ doubt_id: firstDoubtId, user_id: user.id, body })
          .select("id")
          .single();
        if (error) continue;
        if (ans?.id) {
          const { data: acceptRes } = await supabase.rpc("accept_doubt_answer", {
            p_doubt_id: firstDoubtId,
            p_answer_id: ans.id,
            p_bonus_rdm: 10,
          });
          const res = acceptRes as { ok?: boolean } | null;
          if (res?.ok) break;
        }
      }
    }

    return NextResponse.json({ message: "Demo doubts and answers created.", seeded: true, count: inserted.length });
  } catch (e) {
    console.error("seed-doubts error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
