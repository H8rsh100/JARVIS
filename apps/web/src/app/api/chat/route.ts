import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createJarvisTools, SYSTEM_PROMPT, type UnsignedIntent } from "@jarvis/agent";
import { isAddress, type Address } from "viem";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
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

    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const result = await generateText({
      model: openai("gpt-4o-mini"),
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
