import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  // Lazy-fail: importing on cold start without key won't crash; we throw on actual use.
  console.warn("[anthropic] ANTHROPIC_API_KEY puudub .env.local failist");
}

export function getAnthropic() {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY puudub .env.local failist");
  return new Anthropic({
    apiKey,
    // 529 (overloaded) + 5xx retried exponential backoff'iga.
    // Vaikimisi 2 — suurendame 5'le, et üksikud overload'i lained ei katkestaks Magnuse mahutabel-parsimist.
    maxRetries: 5,
  });
}

export const PARSING_MODEL = "claude-sonnet-4-6";
export const MATCHING_MODEL = "claude-sonnet-4-6";
