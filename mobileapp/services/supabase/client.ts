import "@/core/polyfills";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { assertSupabaseEnv, getSupabaseAnonKey, getSupabaseUrl } from "@/core/config/env";
import type { MobileProfile } from "@/core/auth/session";

const STORAGE_KEY = "edublast-supabase-auth";

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  assertSupabaseEnv();
  client = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      storage: secureStoreAdapter,
      storageKey: STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  });
  return client;
}

export async function fetchProfile(userId: string): Promise<MobileProfile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, onboarding_complete, name, first_name, plan_tier, rdm")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as MobileProfile | null;
}
