import { supabase } from "@/integrations/supabase/client";
import { parseHoverPreviewRows, type HoverPreviewRow } from "@/lib/profile/hoverPreview";

type PreviewRpcClient = {
  rpc: (fn: string, args: { p_ids: string[] }) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** Browser → PostgREST batched hover fields. One round trip per chunk of ids. */
export async function fetchHoverPreviewRows(ids: string[]): Promise<HoverPreviewRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await (supabase as unknown as PreviewRpcClient).rpc(
    "profile_public_previews",
    { p_ids: ids }
  );
  if (error) return [];
  return parseHoverPreviewRows(data);
}
