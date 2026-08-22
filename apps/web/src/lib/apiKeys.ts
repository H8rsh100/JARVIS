/** API key helpers for chat + STT. Never log raw key values. */

export function googleAiStudioKey(): string {
  const k = (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
  if (!k || k.includes("your_")) return "";
  // Real Google AI Studio keys start with AIza. Cursor / other keys (AQ.…, sk-AQ.…) are not valid here.
  if (!/^AIza[0-9A-Za-z_-]{10,}$/.test(k)) return "";
  return k;
}

export function googleKeyRejectReason(): string | null {
  const k = (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
  if (!k || k.includes("your_")) {
    return "Missing GOOGLE_GENERATIVE_AI_API_KEY. Get one free at https://aistudio.google.com/apikey (starts with AIza). Or use Chrome for mic: START_JARVIS_CHROME.cmd";
  }
  if (!/^AIza[0-9A-Za-z_-]{10,}$/.test(k)) {
    return "That key is not a Google AI Studio key (needs AIza…). Cursor/other AQ keys will not work. Fix apps/web/.env.local or use Chrome mic: START_JARVIS_CHROME.cmd";
  }
  return null;
}

/** Real OpenAI platform keys only. */
export function openaiPlatformKey(): string {
  const k = (process.env.OPENAI_API_KEY || "").trim();
  if (!k) return "";
  if (k.includes("...") || k.includes("your_") || k.length < 20) return "";
  if (/^sk-AQ\./i.test(k)) return "";
  if (!/^sk-(proj-)?[A-Za-z0-9_-]+$/.test(k)) return "";
  return k;
}
