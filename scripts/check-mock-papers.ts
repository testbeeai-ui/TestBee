import { createClient } from "@supabase/supabase-js";

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("mock_papers")
    .select("id, slug, board, class_level, published, paper_type")
    .eq("board", "CBSE")
    .eq("paper_type", "chapter");

  if (error) {
    console.error("Error querying mock_papers:", error);
    return;
  }

  console.log(`Found ${data.length} CBSE chapter papers in DB.`);
  if (data.length > 0) {
    console.log("First 10 papers:");
    console.log(JSON.stringify(data.slice(0, 10), null, 2));
  }
}

run().catch(console.error);
