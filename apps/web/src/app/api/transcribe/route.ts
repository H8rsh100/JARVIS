import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

function googleKey(): string {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ""
  ).trim();
}

function openaiKey(): string {
  const k = (process.env.OPENAI_API_KEY || "").trim();
  if (!k.startsWith("sk-") || k.includes("...") || k.includes("your_") || k.length < 20) {
    return "";
  }
  return k;
}

function normalizeMime(raw: string | undefined): string {
  const base = (raw || "audio/webm").split(";")[0].trim().toLowerCase();
  if (base === "audio/webm" || base === "video/webm") return "audio/webm";
  if (base.startsWith("audio/")) return base;
  return "audio/webm";
}

async function transcribeWithGemini(
  bytes: Buffer,
  mimeType: string,
  apiKey: string,
): Promise<string> {
  // Direct REST + inline base64 — more reliable than AI SDK file parts for webm in Electron
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Transcribe the spoken English words in this audio. Return ONLY the transcript text, nothing else. If silence, return empty.",
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: bytes.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
      },
    }),
  });

  const raw = (await res.json()) as {
    error?: { message?: string; status?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!res.ok) {
    const msg = raw.error?.message || `Gemini STT HTTP ${res.status}`;
    // Don't scare users with "API key" when chat key is fine — usually audio/format/quota
    if (/api key|permission|unauthenticated/i.test(msg)) {
      throw new Error(
        `Tray voice transcription was rejected by Gemini (${msg}). Typing and Chrome voice still use your normal chat key. Check AI Studio key restrictions / audio access.`,
      );
    }
    throw new Error(msg);
  }

  const text =
    raw.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
    "";
  return text.trim();
}

async function transcribeWithOpenAI(file: File, apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return (transcription.text || "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");

    // Next/Electron may hand back File or Blob
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "audio file required" }, { status: 400 });
    }

    const bytes = Buffer.from(await audio.arrayBuffer());
    if (bytes.length < 200) {
      return NextResponse.json(
        { error: "Recording too short. Tap mic and speak clearly." },
        { status: 400 },
      );
    }

    const mimeType = normalizeMime(audio.type);
    const gKey = googleKey();
    const oKey = openaiKey();

    const errors: string[] = [];

    if (gKey && !gKey.includes("your_")) {
      try {
        const text = await transcribeWithGemini(bytes, mimeType, gKey);
        return NextResponse.json({ text, provider: "google" });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Gemini STT failed");
      }
    }

    if (oKey) {
      try {
        const file = new File([bytes], "jarvis-mic.webm", { type: mimeType });
        const text = await transcribeWithOpenAI(file, oKey);
        return NextResponse.json({ text, provider: "openai" });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "OpenAI Whisper failed");
      }
    }

    if (!gKey && !oKey) {
      return NextResponse.json(
        {
          error:
            "Add GOOGLE_GENERATIVE_AI_API_KEY to apps/web/.env.local (tray voice needs it for transcription).",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          errors[0] ||
          "Tray transcription failed. Chrome voice still works; you can also type.",
      },
      { status: 500 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
