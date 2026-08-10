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

/** Real OpenAI keys only — reject Cursor/other sk-AQ placeholders that pass a naive sk- check. */
function openaiKey(): string {
  const k = (process.env.OPENAI_API_KEY || "").trim();
  if (!k) return "";
  if (k.includes("...") || k.includes("your_") || k.length < 20) return "";
  // Cursor / non-OpenAI keys often look like sk-AQ.… — Whisper will 401
  if (/^sk-AQ\./i.test(k)) return "";
  if (!/^sk-(proj-)?[A-Za-z0-9_-]+$/.test(k)) return "";
  return k;
}

function normalizeMime(raw: string | undefined): string {
  const base = (raw || "audio/webm").split(";")[0].trim().toLowerCase();
  if (base === "audio/webm" || base === "video/webm") return "audio/webm";
  if (base.startsWith("audio/")) return base;
  return "audio/webm";
}

function friendlyProviderError(raw: string): string {
  // Never surface key material from provider error strings
  if (/incorrect api key|invalid.?api.?key|401/i.test(raw)) {
    return "STT API key rejected. Add a Google AI Studio key as GOOGLE_GENERATIVE_AI_API_KEY in apps/web/.env.local (tray mic uses Gemini).";
  }
  return raw.replace(/sk-[A-Za-z0-9._-]{8,}/g, "sk-***");
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
    if (/api key|permission|unauthenticated/i.test(msg)) {
      throw new Error(
        "Gemini rejected the STT key. Check GOOGLE_GENERATIVE_AI_API_KEY in apps/web/.env.local (AI Studio).",
      );
    }
    throw new Error(friendlyProviderError(msg));
  }

  const text =
    raw.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
    "";
  return text.trim();
}

async function transcribeWithOpenAI(file: File, apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey });
  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return (transcription.text || "").trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI Whisper failed";
    throw new Error(friendlyProviderError(msg));
  }
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
            "Tray mic needs GOOGLE_GENERATIVE_AI_API_KEY in apps/web/.env.local (free at https://aistudio.google.com/apikey). Typing still works without it.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error:
          errors[0] ||
          "Tray transcription failed. Typing still works.",
      },
      { status: 500 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json(
      { error: friendlyProviderError(message) },
      { status: 500 },
    );
  }
}
