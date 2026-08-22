import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  googleAiStudioKey,
  googleKeyRejectReason,
  openaiPlatformKey,
} from "@/lib/apiKeys";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizeMime(raw: string | undefined): string {
  const base = (raw || "audio/webm").split(";")[0].trim().toLowerCase();
  if (base === "audio/webm" || base === "video/webm") return "audio/webm";
  if (base.startsWith("audio/")) return base;
  return "audio/webm";
}

function friendlyProviderError(raw: string): string {
  if (/incorrect api key|invalid.?api.?key|401/i.test(raw)) {
    return "STT API key rejected. Use a Google AI Studio key (AIza…) or open Chrome via START_JARVIS_CHROME.cmd for built-in mic.";
  }
  return raw.replace(/sk-[A-Za-z0-9._-]{8,}/g, "sk-***");
}

async function transcribeWithGemini(
  bytes: Buffer,
  mimeType: string,
  apiKey: string,
): Promise<string> {
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
        "Gemini rejected the STT key. Get a free AIza… key at https://aistudio.google.com/apikey — or use START_JARVIS_CHROME.cmd for mic.",
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

export async function GET() {
  const gKey = googleAiStudioKey();
  const oKey = openaiPlatformKey();
  const google = Boolean(gKey);
  const openai = Boolean(oKey);
  const reject = googleKeyRejectReason();
  return NextResponse.json({
    ok: google || openai,
    google,
    openai,
    hint: google
      ? "STT ready (Gemini)"
      : openai
        ? "STT ready (OpenAI Whisper)"
        : reject ||
          "Missing STT key. Prefer Chrome mic: double-click START_JARVIS_CHROME.cmd",
  });
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");

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
    const gKey = googleAiStudioKey();
    const oKey = openaiPlatformKey();
    const errors: string[] = [];

    if (gKey) {
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
            googleKeyRejectReason() ||
            "Tray mic needs a Google AI Studio key (AIza…). Or use START_JARVIS_CHROME.cmd — Chrome mic works without it.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: errors[0] || "Tray transcription failed. Typing still works." },
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
