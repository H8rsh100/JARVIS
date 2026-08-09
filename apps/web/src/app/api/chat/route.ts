import { NextRequest, NextResponse } from "next/server";
import { generateText, type LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createJarvisTools, SYSTEM_PROMPT, type UnsignedIntent } from "@jarvis/agent";
import { isAddress, type Address } from "viem";

export const runtime = "nodejs";
export const maxDuration = 60;

function getModel(): { model: LanguageModel; provider: string } | null {
  const googleKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    return { model: google("gemini-2.0-flash"), provider: "google" };
  }
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { model: openai("gpt-4o-mini"), provider: "openai" };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const resolved = getModel();
    if (!resolved) {
      return NextResponse.json(
        {
          error:
            "Add GOOGLE_GENERATIVE_AI_API_KEY (AI Studio) or OPENAI_API_KEY to apps/web/.env.local",
        },
        { status: 500 },
      );
    }

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

Connected wallet: ${walletAddress || "none"}
Active chainId hint: ${body.chainId ?? "unknown"}`,
      prompt: message,
      tools,
      maxSteps: 5,
    });

    return NextResponse.json({
      text: result.text || "Done.",
      intent: captured,
      provider: resolved.provider,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
