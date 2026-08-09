import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createJarvisTools, SYSTEM_PROMPT, type UnsignedIntent } from "@jarvis/agent";
import { isAddress, type Address } from "viem";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const apiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GOOGLE_GENERATIVE_AI_API_KEY is not configured (Google AI Studio key)",
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

    const google = createGoogleGenerativeAI({ apiKey });

    const result = await generateText({
      model: google("gemini-2.0-flash"),
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
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
