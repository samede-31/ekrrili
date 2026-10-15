"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured. Copy .env.example to .env.local and add your project credentials.");
  return createBrowserClient(config.url, config.anonKey);
}
