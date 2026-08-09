import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "audio file required" }, { status: 400 });
    }

    const googleKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (googleKey) {
      const bytes = Buffer.from(await audio.arrayBuffer());
      const mimeType = audio.type || "audio/webm";
      const google = createGoogleGenerativeAI({ apiKey: googleKey });
      const result = await generateText({
        model: google("gemini-2.0-flash"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribe the spoken words in this audio. Return ONLY the transcript text, nothing else.",
              },
              { type: "file", data: bytes, mimeType },
            ],
          },
        ],
      });
      return NextResponse.json({ text: (result.text || "").trim() });
    }

    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const transcription = await openai.audio.transcriptions.create({
        file: audio,
        model: "whisper-1",
      });
      return NextResponse.json({ text: transcription.text || "" });
    }

    return NextResponse.json(
      {
        error:
          "Add GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY to apps/web/.env.local",
      },
      { status: 500 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
