import { NextRequest, NextResponse } from "next/server";
import { generateText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createJarvisTools, SYSTEM_PROMPT, type UnsignedIntent } from "@jarvis/agent";
import { isAddress, type Address } from "viem";
import { formatISTReply } from "@/lib/datetime";

export const runtime = "nodejs";
export const maxDuration = 30;

function getModel(): { model: LanguageModel; provider: string } | null {
  const googleKey = (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
  if (googleKey && !googleKey.includes("your_")) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    return { model: google("gemini-2.0-flash-lite"), provider: "google" };
  }

  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (
    openaiKey &&
    openaiKey.startsWith("sk-") &&
    !openaiKey.includes("...") &&
    openaiKey.length > 20
  ) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return { model: openai("gpt-4o-mini"), provider: "openai" };
  }
  return null;
}

/** Instant demo replies when the model is slow/unavailable */
function demoReply(message: string, chainId?: number): string | null {
  const m = message.toLowerCase();
  if (/hello|hi\b|hey|who are you|jarvis/.test(m)) {
    return "JARVIS online. Local laptop assistant ready. Wake is Hello Jarvis. I open allowlisted apps and folders on this PC. I do not have full system control.";
  }
  if (
    /what can you|help|capabilit|limits|permissions|full (pc|computer|laptop)|can you control|can you access/.test(
      m,
    )
  ) {
    return "I can open allowlisted apps, folders, and URLs via the local desktop agent, plus camera in this UI. I cannot do full PC control, arbitrary file reads or writes, mouse or keyboard takeover, silent system settings, or unchecked shell. Optional Web3 tools stay confirm-gated in your wallet.";
  }
  if (/do on rootstock|do on base/.test(m)) {
    return "On Base and Sepolia I can help with balances, transfers, and swap quotes. Rootstock supports reads and transfers; swaps are Sepolia and Base only. Every write waits for your wallet confirm.";
  }
  if (/balance/.test(m)) {
    return chainId
      ? `I will query your connected wallet on chain ${chainId}. Connect MetaMask if you have not, then ask again and I will fetch live balance.`
      : "Connect MetaMask, then ask again. I will fetch your live testnet balance.";
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message?: string;
      walletAddress?: string;
      chainId?: number;
    };

    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const walletAddress =
      body.walletAddress && isAddress(body.walletAddress)
        ? (body.walletAddress as Address)
        : undefined;

    const resolved = getModel();

    // Fast path for simple talk (no tool round-trips)
    const quick = demoReply(message, body.chainId);
    const needsTools =
      /send|transfer|swap|deploy|balance|history|token|0x[a-f0-9]{40}/i.test(
        message,
      );

    if (quick && !needsTools) {
      return NextResponse.json({
        text: quick,
        intent: null,
        provider: "demo-fast",
      });
    }

    if (!resolved) {
      return NextResponse.json({
        text:
          quick ||
          "Systems nominal, but no AI key is loaded. Add GOOGLE_GENERATIVE_AI_API_KEY to apps/web/.env.local and restart. Meanwhile: connect MetaMask and use the suggestion chips.",
        intent: null,
        provider: "demo",
      });
    }

    let captured: UnsignedIntent | null = null;
    const tools = createJarvisTools({
      walletAddress,
      onIntent: (intent) => {
        captured = intent;
      },
    });

    const result = await generateText({
      model: resolved.model,
      system: `${SYSTEM_PROMPT}
Wallet: ${walletAddress || "none"} | chainId: ${body.chainId ?? "unknown"}
Clock (authoritative): ${formatISTReply("both")}
Reply in 1-3 short sentences. Sound like Stark's JARVIS: calm, precise, slightly witty. Never use em dashes. For date/time questions use the Clock line above (IST).`,
      prompt: message,
      tools: needsTools ? tools : undefined,
      maxSteps: needsTools ? 2 : 1,
      temperature: 0.35,
    });

    return NextResponse.json({
      text: result.text || quick || "Done.",
      intent: captured,
      provider: resolved.provider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chat failed";
    const fallback = demoReply("help");
    return NextResponse.json({
      text: fallback || `Link unstable: ${message}`,
      intent: null,
      provider: "fallback",
    });
  }
}
