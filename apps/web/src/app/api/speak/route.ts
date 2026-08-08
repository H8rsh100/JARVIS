import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: text.slice(0, 900),
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
