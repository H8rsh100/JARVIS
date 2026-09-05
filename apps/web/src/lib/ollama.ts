/**
 * Local Ollama integration — the offline brain.
 * Used by /api/chat (fallback) and /api/status (probe).
 */

export const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

/** Is the local Ollama daemon alive + does it have a usable model? */
export async function ollamaReady(): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = data.models?.map((m) => m.name) || [];
    const pick =
      models.find((n) => /gemma2/.test(n)) ||
      models.find((n) => /llama/.test(n)) ||
      models.find((n) => /phi/.test(n)) ||
      models[0];
    return pick?.replace(/:latest$/, "") || null;
  } catch {
    return null;
  }
}

/** Ask the local Ollama model. Pure HTTP, no SDK dependency. */
export async function askOllama(
  model: string,
  system: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      system,
      stream: false,
      options: { temperature: 0.4, num_predict: 512 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return (data.response || "").trim();
}
