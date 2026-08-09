import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

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

    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "audio file required" }, { status: 400 });
    }

    const bytes = Buffer.from(await audio.arrayBuffer());
    const mimeType = audio.type || "audio/webm";

    const google = createGoogleGenerativeAI({ apiKey });
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
            {
              type: "file",
              data: bytes,
              mimeType,
            },
          ],
        },
      ],
    });

    return NextResponse.json({ text: (result.text || "").trim() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
