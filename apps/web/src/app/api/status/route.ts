import { NextResponse } from "next/server";
import { googleAiStudioKey, openaiPlatformKey } from "@/lib/apiKeys";
import { ollamaReady } from "@/lib/ollama";

export const runtime = "nodejs";

export async function GET() {
  const google = Boolean(googleAiStudioKey());
  const openai = Boolean(openaiPlatformKey());
  const localModel = await ollamaReady();

  const brains: string[] = [];
  if (google) brains.push("gemini");
  if (openai) brains.push("openai");
  if (localModel) brains.push(`local:${localModel}`);

  const active =
    brains.find((b) => b === "gemini") ||
    brains.find((b) => b === "openai") ||
    brains.find((b) => b.startsWith("local:")) ||
    "offline";

  return NextResponse.json({ ok: true, google, openai, localModel, brains, active });
}
