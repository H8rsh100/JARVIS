import { NextRequest, NextResponse } from "next/server";
import { generateText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { SYSTEM_PROMPT } from "@jarvis/agent";
import { formatISTReply } from "@/lib/datetime";
import { googleAiStudioKey, openaiPlatformKey } from "@/lib/apiKeys";
import { askOllama, ollamaReady } from "@/lib/ollama";

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
    return "JARVIS online. Local laptop assistant ready. Wake is Hey Jarvis, then tap the mic for commands. I open any installed app, folders, and files on this PC. I do not have full system control.";
  }
  if (
    /what can you|help|capabilit|limits|permissions|full (pc|computer|laptop)|can you control|can you access/.test(
      m,
    )
  ) {
    return "I can open any installed app (Start Menu + Store), folders, and files by name via the local desktop agent, plus camera in this UI. I cannot do full PC control, arbitrary file reads or writes, mouse or keyboard takeover, silent system settings, or unchecked shell.";
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

    // Fast path — always free, never touches a model
    const quick = demoReply(message);
    if (quick) {
      return NextResponse.json({ text: quick, provider: "demo-fast" });
    }

    const system = `${SYSTEM_PROMPT}
Clock (authoritative): ${formatISTReply("both")}
Reply in 1-3 short sentences. Sound like Stark's JARVIS: calm, precise, slightly witty. Never use em dashes. For date/time questions use the Clock line above (IST).`;

    const cloud = getModel();

    // 1) Prefer the cloud brain (smart + witty)
    if (cloud) {
      try {
        const result = await generateText({
          model: cloud.model,
          system,
          prompt: message,
          maxSteps: 1,
          temperature: 0.35,
        });
        return NextResponse.json({
          text: result.text || "Done.",
          provider: cloud.provider,
        });
      } catch {
        // cloud failed — fall through to local
      }
    }

    // 2) Fall back to the local brain (offline, unlimited)
    const localModel = await ollamaReady();
    if (localModel) {
      try {
        const text = await askOllama(localModel, system, message);
        if (text) {
          return NextResponse.json({ text, provider: "local" });
        }
      } catch {
        // local failed too — fall through to canned
      }
    }

    // 3) Last resort — offline canned replies
    return NextResponse.json({
      text:
        demoReply("help") ||
        "I'm running with limited brains right now. Try: what can you do? open chrome, what time is it?",
      provider: "offline",
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

