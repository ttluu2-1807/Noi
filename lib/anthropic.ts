import Anthropic from "@anthropic-ai/sdk";

/**
 * Singleton Anthropic client for server-only use.
 * Never import this from a Client Component — the key would leak.
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const MODEL = "claude-sonnet-4-20250514";
