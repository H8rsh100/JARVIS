import { NextRequest, NextResponse } from "next/server";
import { generateText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "@jarvis/agent";
import { formatISTReply } from "@/lib/datetime";
import { googleAiStudioKey, openaiPlatformKey } from "@/lib/apiKeys";

export const runtime = "nodejs";
export const maxDuration = 30;

function getModel(): { model: LanguageModel; provider: string } | null {
  const googleKey = googleAiStudioKey();
  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    return { model: google("gemini-2.0-flash-lite"), provider: "google" };
  }

  const openaiKey = openaiPlatformKey();
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return { model: openai("gpt-4o-mini"), provider: "openai" };
  }
  return null;
}

/** Instant demo replies when the model is slow/unavailable */
function demoReply(message: string): string | null {
  const m = message.toLowerCase();
  if (/hello|hi\b|hey|who are you|jarvis/.test(m)) {
    return "JARVIS online. Local laptop assistant ready. Wake is Hey Jarvis, then tap the mic for commands. I open allowlisted apps and folders on this PC. I do not have full system control.";
  }
  if (
    /what can you|help|capabilit|limits|permissions|full (pc|computer|laptop)|can you control|can you access/.test(
      m,
    )
  ) {
    return "I can open allowlisted apps, folders, and URLs via the local desktop agent, plus camera in this UI. I cannot do full PC control, arbitrary file reads or writes, mouse or keyboard takeover, silent system settings, or unchecked shell.";
  }
  if (/balance|wallet|crypto|swap|token/.test(m)) {
    return "Wallet and chain features were retired in this build. I am focused on laptop control now.";
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message?: string;
    };

    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const resolved = getModel();

    // Fast path for simple talk
    const quick = demoReply(message);
    if (quick) {
      return NextResponse.json({
        text: quick,
        provider: "demo-fast",
      });
    }

    if (!resolved) {
      return NextResponse.json({
        text:
          quick ||
          "Systems nominal, but no AI key is loaded. Add GOOGLE_GENERATIVE_AI_API_KEY to apps/web/.env.local and restart.",
        provider: "demo",
      });
    }

    const result = await generateText({
      model: resolved.model,
      system: `${SYSTEM_PROMPT}
Clock (authoritative): ${formatISTReply("both")}
Reply in 1-3 short sentences. Sound like Stark's JARVIS: calm, precise, slightly witty. Never use em dashes. For date/time questions use the Clock line above (IST).`,
      prompt: message,
      maxSteps: 1,
      temperature: 0.35,
    });

    return NextResponse.json({
      text: result.text || quick || "Done.",
      provider: resolved.provider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chat failed";
    const fallback = demoReply("help");
    return NextResponse.json({
      text: fallback || `Link unstable: ${message}`,
      provider: "fallback",
    });
  }
}
