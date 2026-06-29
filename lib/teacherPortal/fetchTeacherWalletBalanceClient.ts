import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";

export async function fetchTeacherWalletBalanceClient(): Promise<number | null> {
  try {
    const res = await fetchWithClientAuth("/api/teacher/wallet/balance");
    const body = (await res.json()) as { rdm?: number; error?: string };
    if (!res.ok || typeof body.rdm !== "number") return null;
    return Math.max(0, Math.round(body.rdm));
  } catch {
    return null;
  }
}
