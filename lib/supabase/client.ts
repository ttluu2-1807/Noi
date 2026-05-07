"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for browser / Client Components.
 * Call this inside a component — returns a new client each call,
 * which is fine because Supabase internally deduplicates.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
