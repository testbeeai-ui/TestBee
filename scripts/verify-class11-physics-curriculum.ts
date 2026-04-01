/**
 * Verifies Class 11 CBSE Physics curriculum rows in Supabase (plan checklist).
 *
 * Usage (from repo root):
 *   npx tsx scripts/verify-class11-physics-curriculum.ts
 *
 * Loads .env.local then .env if present. Required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Confirms:
 *   - 10 curriculum_units for physics + class_level 11
 *   - Spot-check topics 1.1, 1.2 (four forces subtopics), terminal 15.8 Doppler
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid URL)";
  }
}

type SubtopicRow = { name: string };
type TopicRow = { title: string; curriculum_subtopics?: SubtopicRow[] };
type ChapterRow = { title: string; curriculum_topics?: TopicRow[] };
type UnitRow = {
  unit_label: string;
  unit_title: string;
  sort_order: number | null;
  curriculum_chapters?: ChapterRow[];
};

async function main() {
  tryLoadEnv(".env.local", ".env");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (same as audit:curriculum-cbse)."
    );
  }

  console.log("Class 11 Physics curriculum verification");
  console.log("=========================================");
  console.log(`Supabase host: ${hostFromUrl(supabaseUrl)}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY set: ${anonConfigured}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("curriculum_units")
    .select(
      `
      unit_label, unit_title, sort_order,
      curriculum_chapters (
        title,
        curriculum_topics (
          title,
          curriculum_subtopics ( name )
        )
      )
    `
    )
    .eq("subject", "physics")
    .eq("class_level", 11)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Query failed: ${error.message}`);

  const units = (data ?? []) as UnitRow[];
  const unitCount = units.length;

  if (unitCount !== 10) {
    throw new Error(
      `Expected 10 curriculum_units for physics class 11, got ${unitCount}. Apply supabase/migrations/20260325180000_class11_curriculum_full_reseed.sql (e.g. supabase db push).`
    );
  }

  const labels = units.map((u) => u.unit_label);
  const expectedLabels = [
    "Unit I",
    "Unit II",
    "Unit III",
    "Unit IV",
    "Unit V",
    "Unit VI",
    "Unit VII",
    "Unit VIII",
    "Unit IX",
    "Unit X",
  ];
  for (let i = 0; i < expectedLabels.length; i++) {
    if (labels[i] !== expectedLabels[i]) {
      throw new Error(
        `Unit order/label mismatch at index ${i}: expected "${expectedLabels[i]}", got "${labels[i] ?? ""}"`
      );
    }
  }

  let topic11: TopicRow | undefined;
  let topic12: TopicRow | undefined;
  let dopplerTopic: TopicRow | undefined;

  for (const u of units) {
    for (const ch of u.curriculum_chapters ?? []) {
      for (const t of ch.curriculum_topics ?? []) {
        if (t.title === "1.1 Scope and Excitement of Physics") topic11 = t;
        if (t.title === "1.2 Fundamental Forces in Nature") topic12 = t;
        if (t.title === "15.8 Doppler Effect") dopplerTopic = t;
      }
    }
  }

  if (!topic11) {
    throw new Error('Missing topic "1.1 Scope and Excitement of Physics" (Physical World).');
  }

  if (!topic12) {
    throw new Error('Missing topic "1.2 Fundamental Forces in Nature".');
  }

  const forces = (topic12.curriculum_subtopics ?? []).map((s) => s.name);
  const expectedForces = [
    "Gravitational force",
    "Electromagnetic force",
    "Strong nuclear force",
    "Weak nuclear force",
  ];
  for (const f of expectedForces) {
    if (!forces.includes(f)) {
      throw new Error(
        `Topic 1.2 missing subtopic "${f}". Found: ${forces.join("; ") || "(none)"}`
      );
    }
  }

  if (!dopplerTopic) {
    throw new Error('Missing terminal topic "15.8 Doppler Effect".');
  }

  let chapterCount = 0;
  let topicCount = 0;
  let subtopicCount = 0;
  for (const u of units) {
    const chapters = u.curriculum_chapters ?? [];
    chapterCount += chapters.length;
    for (const ch of chapters) {
      const topics = ch.curriculum_topics ?? [];
      topicCount += topics.length;
      for (const t of topics) {
        subtopicCount += (t.curriculum_subtopics ?? []).length;
      }
    }
  }

  console.log("\nCounts (physics, class 11)");
  console.log(`- Units: ${unitCount}`);
  console.log(`- Chapters: ${chapterCount}`);
  console.log(`- Topics: ${topicCount}`);
  console.log(`- Subtopics: ${subtopicCount}`);
  console.log("\nSpot-check OK: 1.1, 1.2 (four forces), 15.8 Doppler Effect");
  console.log("All checks passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
