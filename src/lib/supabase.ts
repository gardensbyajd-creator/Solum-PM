import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PublicEnvironment = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

let client: SupabaseClient | null = null;

export function getSupabasePublicConfig(environment?: PublicEnvironment): PublicEnvironment {
  const source = environment ?? {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  return {
    VITE_SUPABASE_URL: source.VITE_SUPABASE_URL?.trim(),
    VITE_SUPABASE_PUBLISHABLE_KEY: source.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
  };
}

export function hasSupabasePublicConfig(environment?: PublicEnvironment) {
  const config = getSupabasePublicConfig(environment);
  return Boolean(config.VITE_SUPABASE_URL && config.VITE_SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabaseClient() {
  const config = getSupabasePublicConfig();
  if (!config.VITE_SUPABASE_URL || !config.VITE_SUPABASE_PUBLISHABLE_KEY) return null;
  if (!client) client = createClient(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_PUBLISHABLE_KEY);
  return client;
}
