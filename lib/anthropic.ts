import Anthropic from "@anthropic-ai/sdk";

/**
 * Singleton Anthropic client for server-only use.
 * Never import this from a Client Component — the key would leak.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Anthropic deprecated claude-sonnet-4-20250514 — replaced with the
// current generation Sonnet 4.6, same tier (best balance of quality vs
// cost for our translation / extraction / chat workloads).
export const MODEL = "claude-sonnet-4-6";
