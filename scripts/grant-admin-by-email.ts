/**
 * One-off: grant admin by email.
 * Usage: npx tsx --env-file-if-exists=.env scripts/grant-admin-by-email.ts mailidpwd@gmail.com
 */
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npx tsx scripts/grant-admin-by-email.ts <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let page = 1;
  let found: { id: string; email?: string } | null = null;
  while (page <= 20 && !found) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    found =
      data.users.find((u) => (u.email ?? "").trim().toLowerCase() === email) ?? null;
    if (data.users.length < 200) break;
    page += 1;
  }

  if (!found) {
    console.error(`No auth user for ${email}. They must sign up once, then run this again.`);
    process.exit(2);
  }

  const uid = found.id;
  await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
  const { error: roleErr } = await supabase
    .from("user_roles")
    .insert({ user_id: uid, role: "admin" });
  if (roleErr) console.warn("user_roles:", roleErr.message);

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ role: "admin", updated_at: new Date().toISOString() })
    .eq("id", uid);
  if (profErr) throw profErr;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name")
    .eq("id", uid)
    .single();

  console.log(JSON.stringify({ ok: true, userId: uid, email: found.email, profile }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
