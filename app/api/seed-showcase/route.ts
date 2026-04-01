import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/integrations/supabase/server";

/**
 * Seeds the full Gyan++ showcase — AI bot questions, teacher answers, student comments —
 * exactly matching the investor demo mockup. Uses service role to create demo auth users.
 */

// Fixed demo user IDs (deterministic so re-seeding is idempotent)
const DEMO_IDS = {
  gyanBot: "10000000-0000-0000-0000-000000000001",
  gyanAI:  "10000000-0000-0000-0000-000000000002",
  drSuresh:"10000000-0000-0000-0000-000000000003",
  profRao: "10000000-0000-0000-0000-000000000004",
  arjunK:  "10000000-0000-0000-0000-000000000005",
  priyaM:  "10000000-0000-0000-0000-000000000006",
  nidhiK:  "10000000-0000-0000-0000-000000000007",
  snehaR:  "10000000-0000-0000-0000-000000000008",
};

const PERSONAS = [
  { id: DEMO_IDS.gyanBot,  email: "gyan-bot@showcase.demo",   name: "Gyan++ Bot",  role: "ai",      rdm: 0,    lifetime_answer_rdm: 0 },
  { id: DEMO_IDS.gyanAI,   email: "gyan-ai@showcase.demo",    name: "Gyan++ AI",   role: "ai",      rdm: 0,    lifetime_answer_rdm: 0 },
  { id: DEMO_IDS.drSuresh, email: "dr-suresh@showcase.demo",  name: "Dr. Suresh",  role: "teacher", rdm: 1200, lifetime_answer_rdm: 1200 },
  { id: DEMO_IDS.profRao,  email: "prof-rao@showcase.demo",   name: "Prof. Rao",   role: "teacher", rdm: 980,  lifetime_answer_rdm: 980 },
  { id: DEMO_IDS.arjunK,   email: "arjun-k@showcase.demo",    name: "Arjun K",     role: "student", rdm: 340,  lifetime_answer_rdm: 120 },
  { id: DEMO_IDS.priyaM,   email: "priya-m@showcase.demo",    name: "Priya M",     role: "student", rdm: 280,  lifetime_answer_rdm: 94 },
  { id: DEMO_IDS.nidhiK,   email: "nidhi-k@showcase.demo",    name: "Nidhi K",     role: "student", rdm: 190,  lifetime_answer_rdm: 81 },
  { id: DEMO_IDS.snehaR,   email: "sneha-r@showcase.demo",    name: "Sneha R",     role: "student", rdm: 210,  lifetime_answer_rdm: 75 },
];

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const cookieSupabase = await createClient();
    let user = (await cookieSupabase.auth.getUser()).data?.user ?? null;
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!user && token) {
      const { data: { user: u } } = await cookieSupabase.auth.getUser(token);
      user = u ?? null;
    }
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: "Service role not configured. Add SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

    // ── Idempotency check (title-based, survives ID remapping) ──
    const { data: existing } = await admin
      .from("doubts")
      .select("id")
      .ilike("title", "%frictionless incline%")
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ message: "Showcase data already seeded.", seeded: false });
    }

    // ── Create demo auth users + profiles ─────────────────────
    for (const p of PERSONAS) {
      // Try create auth user with fixed ID (silently skip if already exists)
      await admin.auth.admin.createUser({
        email: p.email,
        password: "ShowcaseDemo2024!",
        email_confirm: true,
        user_metadata: { name: p.name },
      });
      // Upsert profile (works whether user existed or was just created)
      const { data: existingProfile } = await admin.from("profiles").select("id").eq("id", p.id).maybeSingle();
      if (!existingProfile) {
        // Find the auth user we just created to get their real ID, then insert profile
        const { data: allUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const authUser = allUsers?.users?.find((u: { email?: string }) => u.email === p.email);
        const realId = authUser?.id ?? p.id;
        await admin.from("profiles").upsert({
          id: realId,
          name: p.name,
          role: p.role,
          rdm: p.rdm,
          lifetime_answer_rdm: p.lifetime_answer_rdm,
        }, { onConflict: "id" });
        // Update DEMO_IDS map for use in content creation below
        (DEMO_IDS as Record<string, string>)[Object.entries(DEMO_IDS).find(([, v]) => v === p.id)?.[0] ?? ""] = realId;
      }
    }

    // Re-resolve IDs after possible re-mapping
    const { data: allUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const userMap: Record<string, string> = {};
    for (const p of PERSONAS) {
      const found = allUsers?.users?.find((u: { email?: string }) => u.email === p.email);
      userMap[p.email] = found?.id ?? p.id;
    }

    const uid = {
      bot:    userMap["gyan-bot@showcase.demo"],
      ai:     userMap["gyan-ai@showcase.demo"],
      suresh: userMap["dr-suresh@showcase.demo"],
      rao:    userMap["prof-rao@showcase.demo"],
      arjun:  userMap["arjun-k@showcase.demo"],
      priya:  userMap["priya-m@showcase.demo"],
      nidhi:  userMap["nidhi-k@showcase.demo"],
      sneha:  userMap["sneha-r@showcase.demo"],
      me:     user.id,
    };

    // ── Timestamp helpers ─────────────────────────────────────
    const now = new Date();
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    const mins  = (m: number) => ago(m * 60 * 1000);
    const hours = (h: number) => ago(h * 60 * 60 * 1000);
    const days  = (d: number) => ago(d * 24 * 60 * 60 * 1000);

    // ── DOUBT 1: Normal force on frictionless incline ─────────
    const { data: d1 } = await admin.from("doubts").insert({
      user_id: uid.bot,
      title: "Why does the normal force do no work when a block slides down a frictionless incline — even though it acts on the block throughout the motion?",
      body: "My textbook says work = F·d·cos(θ) and normal force is perpendicular to motion so cos(90°) = 0. But I don't intuitively understand why a force that's clearly present does zero work. Can someone break it down?",
      subject: "Physics",
      upvotes: 34,
      is_resolved: true,
      bounty_rdm: 50,
      bounty_escrowed_at: mins(5),
      views: 142,
      created_at: mins(2),
    }).select("id").single();

    if (d1?.id) {
      // AI answer
      await admin.from("doubt_answers").insert({
        doubt_id: d1.id,
        user_id: uid.ai,
        body: "Work is done on an object only when a force has a component in the direction of displacement. On a frictionless incline, the normal force acts perpendicular to the surface — and the block moves along the surface. Since the angle between the normal force vector and the displacement vector is always 90°, the work done W = F·d·cos(90°) = 0. The normal force prevents penetration into the surface but contributes zero energy to the motion.",
        upvotes: 28,
        is_accepted: false,
        created_at: mins(2),
      });
      // Teacher answer — Dr. Suresh
      await admin.from("doubt_answers").insert({
        doubt_id: d1.id,
        user_id: uid.suresh,
        body: "Excellent AI explanation. I would add: this is why the Work-Energy Theorem only tracks forces with non-zero projections. In exams, always draw the force-displacement angle explicitly — most mistakes come from forgetting this step. Remember: N is a constraint force, not an energy source.",
        upvotes: 41,
        is_accepted: true,
        created_at: mins(1),
      });
      // Student comments
      await admin.from("doubt_answers").insert({
        doubt_id: d1.id,
        user_id: uid.arjun,
        body: "This finally clicked for me — the perpendicular key is so important. Saving this one.",
        upvotes: 4,
        created_at: mins(10),
      });
      await admin.from("doubt_answers").insert({
        doubt_id: d1.id,
        user_id: uid.priya,
        body: "Can this logic apply to tension in circular motion too? Tension is always centripetal — also perpendicular to velocity?",
        upvotes: 7,
        created_at: mins(8),
      });
    }

    // ── DOUBT 2: Genotype vs Phenotype (posted by logged-in user) ──
    const { data: d2 } = await admin.from("doubts").insert({
      user_id: uid.me,
      title: "Difference between genotype and phenotype with an example — can someone give a simple example like peas?",
      body: "I understand genotype is the genetic code and phenotype is what you observe. But I get confused with dominant/recessive alleles. Can someone explain with pea plant height like Mendel used?",
      subject: "Biology",
      upvotes: 12,
      bounty_rdm: 20,
      bounty_escrowed_at: days(13),
      views: 89,
      created_at: days(13),
    }).select("id").single();

    if (d2?.id) {
      await admin.from("doubt_answers").insert({
        doubt_id: d2.id,
        user_id: uid.ai,
        body: "Genotype is the actual genetic code in an organism's DNA — the instructions. Phenotype is what those instructions produce — the observable trait. In Mendel's pea experiment: a plant with genotype Tt (one dominant, one recessive allele for tall/short) will have the phenotype of being tall, because T is dominant. Two plants can share the same phenotype (both tall) but different genotypes (TT vs Tt). Phenotype is shaped by genotype + environment.",
        upvotes: 18,
        created_at: days(13),
      });
      await admin.from("doubt_answers").insert({
        doubt_id: d2.id,
        user_id: uid.nidhi,
        body: "Great example! Does environment affect genotype too or only phenotype?",
        upvotes: 3,
        created_at: hours(3),
      });
    }

    // ── DOUBT 3: Redox equation (AI-generated, teacher tagged) ──
    const { data: d3 } = await admin.from("doubts").insert({
      user_id: uid.bot,
      title: "Best way to balance a redox equation in acidic medium — what are the half-reaction steps?",
      body: "I keep getting wrong coefficients when balancing MnO₄⁻ + Fe²⁺ → Mn²⁺ + Fe³⁺ in acidic medium. What exactly are the half-reaction steps and in what order?",
      subject: "Chemistry",
      upvotes: 9,
      bounty_rdm: 30,
      bounty_escrowed_at: mins(6),
      views: 64,
      created_at: mins(5),
    }).select("id").single();

    if (d3?.id) {
      await admin.from("doubt_answers").insert({
        doubt_id: d3.id,
        user_id: uid.ai,
        body: "To balance a redox equation in acidic medium using the half-reaction method: (1) Split into two half-reactions — oxidation and reduction. (2) Balance atoms other than O and H. (3) Balance O by adding H₂O. (4) Balance H by adding H⁺. (5) Balance charge by adding electrons. (6) Multiply half-reactions so electrons cancel. (7) Add, cancel electrons, simplify. For MnO₄⁻ + Fe²⁺ → Mn²⁺ + Fe³⁺: Mn goes from +7 to +2 (gain of 5e⁻); Fe goes from +2 to +3 (loss of 1e⁻). Multiply Fe half-reaction by 5 to balance electrons.",
        upvotes: 22,
        created_at: mins(5),
      });
      await admin.from("doubt_answers").insert({
        doubt_id: d3.id,
        user_id: uid.rao,
        body: "The AI answer is correct. Exam tip: always state the half-reactions separately before combining — examiners at CBSE and JEE often give partial marks for each step. Common mistake is adding H₂O to the wrong side. Remember: in acidic medium, O is balanced with H₂O; H is balanced with H⁺. In basic medium the approach differs — I'll post a follow-up on that.",
        upvotes: 53,
        is_accepted: true,
        created_at: mins(4),
      });
      await admin.from("doubt_answers").insert({
        doubt_id: d3.id,
        user_id: uid.sneha,
        body: "What changes in basic medium? Does H₂O move to the other side?",
        upvotes: 5,
        created_at: mins(12),
      });
    }

    // ── DOUBT 4: Boltzmann constant (generating...) ──────────
    await admin.from("doubts").insert({
      user_id: uid.bot,
      title: "What is the significance of the Boltzmann constant and how does it connect the macroscopic and microscopic worlds?",
      body: "I know k_B = 1.38 × 10⁻²³ J/K but I don't understand what it physically means. How does it bridge thermodynamics and statistical mechanics?",
      subject: "Physics",
      upvotes: 0,
      views: 12,
      created_at: mins(1),
    });

    // ── Extra doubts to fill the feed ────────────────────────
    await admin.from("doubts").insert({
      user_id: uid.arjun,
      title: "How does entropy increase in isolated systems? Is it always inevitable?",
      body: "The second law says entropy always increases but I've seen examples where it seems to decrease locally. What's the full picture?",
      subject: "Physics",
      upvotes: 15,
      views: 78,
      created_at: hours(2),
    });

    await admin.from("doubts").insert({
      user_id: uid.priya,
      title: "When to use Nernst equation in exam problems?",
      body: "I know the Nernst equation adjusts EMF for non-standard conditions but when exactly should I apply it vs just using E°cell?",
      subject: "Chemistry",
      upvotes: 8,
      views: 45,
      created_at: hours(4),
    });

    await admin.from("doubts").insert({
      user_id: uid.nidhi,
      title: "Integration by parts — when to choose u and dv in LIATE order?",
      body: "I keep choosing the wrong function as u. My teacher mentioned LIATE but I don't always know how to apply it.",
      subject: "Math",
      upvotes: 22,
      views: 110,
      created_at: hours(1),
    });

    // ── Bounty Board: bump bounties on showcase doubts ────────
    if (d1?.id) await admin.from("doubts").update({ bounty_rdm: 50 }).eq("id", d1.id);
    if (d2?.id) await admin.from("doubts").update({ bounty_rdm: 20 }).eq("id", d2.id);
    if (d3?.id) await admin.from("doubts").update({ bounty_rdm: 30 }).eq("id", d3.id);

    return NextResponse.json({
      ok: true,
      message: "Showcase data seeded. You should see Dr. Suresh, Prof. Rao, Arjun K, Priya M and more in the feed!",
      seeded: true,
    });
  } catch (e) {
    console.error("seed-showcase error", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
