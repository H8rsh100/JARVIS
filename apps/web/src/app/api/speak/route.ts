import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Google AI Studio does not expose OpenAI-style TTS.
 * Client falls back to browser speechSynthesis when this returns 204.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    // Prefer client-side Web Speech API with Google key setup.
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
