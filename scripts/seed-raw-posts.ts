/**
 * Seeds demo rows into public.lessons_raw_posts for the Lessons raw social feed.
 * Prefers student profiles whose names match Arjun, Priya, Nidhi, Vikram; otherwise
 * uses the first four students by created_at. Idempotent: removes prior seed via tag.
 *
 * Usage (from repo root):
 *   npx tsx scripts/seed-raw-posts.ts
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SEED_TAG = "lessons-seed-v1";

function tryLoadEnv(...names: string[]) {
  for (const name of names) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) process.env[key] = val;
    }
  }
}

tryLoadEnv(".env.local", ".env");

async function pickStudentIds(
  admin: ReturnType<typeof createClient>,
  preferredFirstNames: string[]
): Promise<string[]> {
  const picked: string[] = [];
  const used = new Set<string>();

  for (const first of preferredFirstNames) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, name")
      .eq("role", "student")
      .ilike("name", `%${first}%`)
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) continue;
    const id = data?.[0]?.id;
    if (id && !used.has(id)) {
      used.add(id);
      picked.push(id);
    }
  }

  const need = 4 - picked.length;
  if (need > 0) {
    const { data: rest, error } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .order("created_at", { ascending: true })
      .limit(need + used.size);

    if (!error && rest) {
      for (const row of rest) {
        if (picked.length >= 4) break;
        if (row.id && !used.has(row.id)) {
          used.add(row.id);
          picked.push(row.id);
        }
      }
    }
  }

  return picked.slice(0, 4);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { error: delErr } = await admin.from("lessons_raw_posts").delete().contains("tags", [SEED_TAG]);
  if (delErr) {
    console.warn("Delete existing seed (optional):", delErr.message);
  }

  const profileIds = await pickStudentIds(admin, ["Arjun", "Priya", "Nidhi", "Vikram"]);
  if (profileIds.length < 4) {
    console.error("Need at least 4 student profiles in the database; found:", profileIds.length);
    process.exit(1);
  }

  const seeds: {
    title: string;
    subject: string;
    chapter_ref: string | null;
    content: string;
    tags: string[];
  }[] = [
    {
      title: "Entropy finally clicked after mixed problems",
      subject: "physics",
      chapter_ref: "Thermodynamics · Laws",
      content:
        "Entropy always increases in an isolated system — finally clicked after doing mixed problems on reversible vs irreversible paths. Chapter 2.1 is a good one to try out if you are stuck on the sign conventions.",
      tags: [SEED_TAG, "Thermodynamics", "Entropy"],
    },
    {
      title: "Electrode potential — SHE reference cheat sheet",
      subject: "chemistry",
      chapter_ref: "Electrochemistry · Electrode potential",
      content:
        "Standard electrode potential — remember SHE is 0 V reference; stronger oxidant = more positive E°. Saved this as 5 bullets before the mock.",
      tags: [SEED_TAG, "Electrochemistry"],
    },
    {
      title: "Mock #3: 86% — integration by parts feels automatic",
      subject: "math",
      chapter_ref: "Calculus · Integration",
      content:
        "Integration by parts finally feels automatic when I write u/dv explicitly every time. Sharing in case it helps someone else.",
      tags: [SEED_TAG, "Calculus", "Mock"],
    },
    {
      title: "Heart walls: auricles vs ventricles (exam-style)",
      subject: "biology",
      chapter_ref: "Structural organisation · Heart",
      content:
        "Working through this: why do auricles have thin walls compared to ventricles? I get the pressure argument but want a crisp exam-style answer.",
      tags: [SEED_TAG, "Heart"],
    },
  ];

  for (let i = 0; i < seeds.length; i++) {
    const userId = profileIds[i]!;
    const row = seeds[i]!;
    const { error } = await admin.from("lessons_raw_posts").insert({
      user_id: userId,
      kind: "post",
      title: row.title,
      content: row.content,
      tags: row.tags,
      subject: row.subject,
      chapter_ref: row.chapter_ref,
    });
    if (error) {
      console.error("Insert failed:", error.message);
      process.exit(1);
    }
  }

  console.log(`Seeded ${seeds.length} lessons_raw_posts for profile IDs:`, profileIds);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
