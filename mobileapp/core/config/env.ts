import Constants from "expo-constants";
import {
  LOCAL_API_BASE_URL,
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_URL,
} from "@/core/config/supabaseEnv.local";

type PublicEnvExtra = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_API_BASE_URL?: string;
  edublast?: {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    apiBaseUrl?: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Collect every `extra` bag Expo may expose (Expo Go vs dev build vs legacy manifest). */
function collectExtraBags(): PublicEnvExtra[] {
  const bags: PublicEnvExtra[] = [];
  const push = (value: unknown) => {
    const record = asRecord(value);
    if (record) bags.push(record as PublicEnvExtra);
  };

  push(Constants.expoConfig?.extra);
  push(Constants.expoGoConfig?.extra);
  push(asRecord(Constants.expoConfig)?.extra);
  push(asRecord(Constants.manifest)?.extra);
  push(asRecord(Constants.manifest2)?.extra);
  push(asRecord(asRecord(Constants.manifest2)?.extra)?.expoClient);

  const expoClient = asRecord(asRecord(Constants.manifest2)?.extra)?.expoClient;
  push(asRecord(expoClient)?.extra);

  return bags;
}

function fromExtra(key: keyof PublicEnvExtra): string {
  for (const bag of collectExtraBags()) {
    const direct = bag[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();

    const nested = bag.edublast;
    if (nested) {
      if (key === "EXPO_PUBLIC_SUPABASE_URL" && nested.supabaseUrl?.trim()) {
        return nested.supabaseUrl.trim();
      }
      if (key === "EXPO_PUBLIC_SUPABASE_ANON_KEY" && nested.supabaseAnonKey?.trim()) {
        return nested.supabaseAnonKey.trim();
      }
      if (key === "EXPO_PUBLIC_API_BASE_URL" && nested.apiBaseUrl?.trim()) {
        return nested.apiBaseUrl.trim();
      }
    }
  }
  return "";
}

/**
 * Metro inlines literal `process.env.EXPO_PUBLIC_*` at bundle time.
 * `Constants.expoConfig.extra` is resolved at runtime (required for Expo Go).
 */
function resolvePublicEnv(
  inlined: string | undefined,
  key: keyof PublicEnvExtra
): string {
  return inlined?.trim() || fromExtra(key);
}

export function getSupabaseUrl(): string {
  return (
    resolvePublicEnv(process.env.EXPO_PUBLIC_SUPABASE_URL, "EXPO_PUBLIC_SUPABASE_URL") ||
    LOCAL_SUPABASE_URL
  );
}

export function getSupabaseAnonKey(): string {
  return (
    resolvePublicEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, "EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
    LOCAL_SUPABASE_ANON_KEY
  );
}

export function getApiBaseUrl(): string {
  return (
    resolvePublicEnv(process.env.EXPO_PUBLIC_API_BASE_URL, "EXPO_PUBLIC_API_BASE_URL") ||
    LOCAL_API_BASE_URL ||
    "http://10.0.2.2:3000"
  );
}

export const APP_SCHEME = "edublast";

export function assertSupabaseEnv(): void {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy mobileapp/.env.example → .env"
    );
  }
}
