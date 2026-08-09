"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Address } from "viem";
import type { ActivityItem, UnsignedIntent } from "@jarvis/agent";
import { ActionPreview } from "@/components/ActionPreview";
import { ArcCore } from "@/components/ArcCore";
import {
  agentHealth,
  executeLocalAction,
  parseLocalAction,
} from "@/lib/localActions";
import {
  CAPABILITIES_FULL,
  CAPABILITIES_SPOKEN,
  isCapabilitiesQuestion,
} from "@/lib/capabilities";
import { formatISTReply, isDateTimeQuestion } from "@/lib/datetime";

type Props = {
  walletAddress?: Address;
  chainId: number;
  isConnected: boolean;
  spendCap: string;
};

/** Only "Hello Jarvis" (optional comma / trailing punctuation) wakes from standby. */
const WAKE = /^\s*hello\s*,?\s*jarvis\s*[.!?]?\s*$/i;

function isWake(text: string) {
  return WAKE.test(text.trim());
}

export function Assistant({
  walletAddress,
  chainId,
  isConnected,
  spendCap,
}: Props) {
  const [awake, setAwake] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [intent, setIntent] = useState<UnsignedIntent | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordModeRef = useRef(false);

  const pushActivity = useCallback(
    (item: Omit<ActivityItem, "id" | "at"> & { id?: string }) => {
      const full: ActivityItem = {
        id: item.id || `act_${Date.now()}`,
        at: Date.now(),
        userText: item.userText,
        assistantText: item.assistantText,
        intentId: item.intentId,
        txHash: item.txHash,
        status: item.status,
        error: item.error,
      };
      setActivity((prev) => [full, ...prev].slice(0, 40));
    },
    [],
  );

  const speak = useCallback((text: string) => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text.slice(0, 400));
        utter.rate = 1.12;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      /* optional */
    }
  }, []);

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      camStreamRef.current = stream;
      setCameraOn(true);
      return true;
    } catch {
      setError("Camera permission denied.");
      return false;
    }
  }, []);

  const closeCamera = useCallback(() => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    if (cameraOn && videoRef.current && camStreamRef.current) {
      videoRef.current.srcObject = camStreamRef.current;
      void videoRef.current.play();
    }
  }, [cameraOn]);

  useEffect(() => {
    return () => {
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const runChat = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      if (!text) return;

      // Standby: ignore everything until exact wake phrase
      if (!awake) {
        if (!isWake(text)) return;
        setBusy(true);
        setError(null);
        setStatus("");
        setTranscript(text);
        setAwake(true);
        const line = "Hello sir, ready to assist";
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(line);
        setBusy(false);
        return;
      }

      setBusy(true);
      setError(null);
      setStatus("");
      setTranscript(text);
      setReply("");

      if (/open (the )?camera|start camera|show camera|enable camera/i.test(text)) {
        const ok = await openCamera();
        const line = ok
          ? "Camera feed online."
          : "I could not access the camera. Allow permission in the browser.";
        setReply(line);
        pushActivity({
          userText: text,
          assistantText: line,
          status: ok ? "info" : "error",
        });
        speak(line);
        setBusy(false);
        return;
      }
      if (/close (the )?camera|stop camera|hide camera|disable camera/i.test(text)) {
        closeCamera();
        const line = "Camera feed closed.";
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(line);
        setBusy(false);
        return;
      }
      if (/go (to )?sleep|standby|good ?night jarvis|lock jarvis/i.test(text)) {
        closeCamera();
        setAwake(false);
        const line = "Entering standby.";
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(line);
        setBusy(false);
        return;
      }

      // Capability / limits briefing (no LLM needed)
      if (isCapabilitiesQuestion(text)) {
        const line = CAPABILITIES_FULL;
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(CAPABILITIES_SPOKEN);
        setBusy(false);
        return;
      }

      // Date / time in Indian Standard Time
      const when = isDateTimeQuestion(text);
      if (when) {
        const line = formatISTReply(when);
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(line);
        setBusy(false);
        return;
      }

      // Local laptop actions (desktop agent on localhost:3847)
      const local = parseLocalAction(text);
      if (local) {
        setStatus("working");
        const online = await agentHealth();
        if (!online) {
          const line =
            "Desktop agent is offline. Run: pnpm agent  (keep that terminal open)";
          setReply(line);
          setError(line);
          pushActivity({ userText: text, assistantText: line, status: "error" });
          speak(line);
          setBusy(false);
          setStatus("");
          return;
        }
        try {
          if (local.risky) {
            const ok = window.confirm(
              `${local.summary}?\n\nThis affects your whole PC. Continue?`,
            );
            if (!ok) {
              const line = "Cancelled.";
              setReply(line);
              pushActivity({
                userText: text,
                assistantText: line,
                status: "info",
              });
              speak(line);
              setBusy(false);
              setStatus("");
              return;
            }
          }
          const result = await executeLocalAction(local, {
            confirm: local.risky === true,
          });
          if (!result.ok) {
            throw new Error(result.error || "Action failed");
          }
          const line = result.did || local.summary;
          setReply(line);
          pushActivity({ userText: text, assistantText: line, status: "info" });
          speak(line);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Local action failed";
          setError(msg);
          setReply(msg);
          pushActivity({ userText: text, status: "error", error: msg });
          speak(msg);
        } finally {
          setBusy(false);
          setStatus("");
        }
        return;
      }

      pushActivity({ userText: text, status: "pending" });
      setStatus("working");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            walletAddress,
            chainId,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Chat failed" }));
          throw new Error(err.error || "Chat failed");
        }

        const data = (await res.json()) as {
          text: string;
          intent?: UnsignedIntent | null;
        };

        if (data.intent) setIntent(data.intent);
        setReply(data.text || "");
        pushActivity({
          userText: text,
          assistantText: data.text,
          intentId: data.intent?.id,
          status: data.intent ? "pending" : "info",
        });
        if (data.text) speak(data.text);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        pushActivity({ userText: text, status: "error", error: msg });
        speak(`Error. ${msg}`);
      } finally {
        setStatus("");
        setBusy(false);
      }
    },
    [awake, walletAddress, chainId, pushActivity, speak, openCamera, closeCamera],
  );

  const stopListening = useCallback(() => {
    if (recordModeRef.current) {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      } else {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordModeRef.current = false;
        setListening(false);
      }
      return;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  /** Tray / Electron: record mic locally, transcribe via Gemini (Web Speech is broken in Electron). */
  const startRecordListen = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined") {
      setError("Audio recording not supported here. Type instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      recordModeRef.current = true;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      setListening(true);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setListening(false);
        recordModeRef.current = false;
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (!chunks.length) return;

        const raw = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        if (raw.size < 800) return;

        setBusy(true);
        setStatus("working");
        setError(null);
        try {
          // Electron bug: streaming MediaRecorder blobs into fetch FormData
          // throws chunked_data_pipe OnSizeReceived Error -2. Re-wrap with known size.
          const buffer = await raw.arrayBuffer();
          const file = new File([buffer], "jarvis-mic.webm", {
            type: "audio/webm",
          });
          const form = new FormData();
          form.append("audio", file);
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
            cache: "no-store",
          });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) throw new Error(data.error || "Transcription failed");
          const said = (data.text || "").trim();
          if (!said) {
            setError("Did not catch that. Tap mic and speak again.");
            setBusy(false);
            setStatus("");
            return;
          }
          setStatus("");
          void runChat(said);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Mic transcription failed");
          setBusy(false);
          setStatus("");
        }
      };

      // timeslice so chunks flush cleanly before stop (helps Electron uploads)
      recorder.start(250);
      window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          try {
            mediaRecorderRef.current.requestData();
            mediaRecorderRef.current.stop();
          } catch {
            /* ignore */
          }
        }
      }, 6000);
    } catch {
      recordModeRef.current = false;
      setListening(false);
      setError("Allow microphone access, then try again.");
    }
  }, [runChat]);

  /** Chrome / Edge browser: Web Speech API (fast). */
  const startWebSpeechListen = useCallback(async () => {
    setError(null);

    type RecEvent = {
      error?: string;
      results?: ArrayLike<ArrayLike<{ transcript: string }>>;
    };
    type Rec = {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      continuous: boolean;
      start: () => void;
      stop: () => void;
      abort: () => void;
      onresult: ((event: RecEvent) => void) | null;
      onerror: ((event: RecEvent) => void) | null;
      onend: (() => void) | null;
    };

    const w = window as unknown as {
      SpeechRecognition?: new () => Rec;
      webkitSpeechRecognition?: new () => Rec;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      // No Web Speech — use recorder path
      void startRecordListen();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setError("Allow microphone access in the browser address bar, then try again.");
      return;
    }

    try {
      recognitionRef.current?.abort?.();
    } catch {
      /* ignore */
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognitionRef.current = recognition;
    recordModeRef.current = false;
    setListening(true);

    recognition.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript?.trim();
      setListening(false);
      recognitionRef.current = null;
      if (said) void runChat(said);
    };

    recognition.onerror = (event) => {
      const code = event.error || "";
      setListening(false);
      recognitionRef.current = null;

      if (code === "aborted" || code === "no-speech") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone blocked. Allow mic, then try again.");
        return;
      }
      if (code === "network") {
        // Auto-fallback: works in tray / offline-Google cases
        void startRecordListen();
        return;
      }
      if (code === "audio-capture") {
        setError("No microphone found.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
      void startRecordListen();
    }
  }, [runChat, startRecordListen]);

  const startListening = useCallback(async () => {
    const inElectron = navigator.userAgent.includes("Electron");
    if (inElectron) {
      // Dream path: tray window voice without Chrome Web Speech
      await startRecordListen();
      return;
    }
    await startWebSpeechListen();
  }, [startRecordListen, startWebSpeechListen]);

  const toggleListening = useCallback(() => {
    if (busy) return;
    if (listening) stopListening();
    else void startListening();
  }, [busy, listening, startListening, stopListening]);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="relative flex flex-col items-center">
        {listening && (
          <motion.span
            className="pointer-events-none absolute inset-0 -m-4 rounded-full border border-signal/30"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0.35, 0.8, 0.35], scale: [1, 1.08, 1] }}
            transition={{ duration: 1.3, repeat: Infinity }}
          />
        )}
        <ArcCore listening={listening} busy={busy} />
        <button
          type="button"
          disabled={busy}
          onClick={toggleListening}
          className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          aria-label="Tap to talk"
        >
          <span className="pointer-events-none font-mono text-[10px] uppercase tracking-[0.28em] text-ink">
            {listening ? "on" : busy ? "…" : "mic"}
          </span>
        </button>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-mist/75">
        {listening
          ? "Listening..."
          : busy || status
            ? status === "working"
              ? "Transcribing..."
              : "Working..."
            : awake
              ? "Online"
              : "Standby"}
      </p>

      {cameraOn && (
        <div className="relative w-full overflow-hidden rounded-2xl border border-signal/25 shadow-glow">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black object-cover"
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-0 border border-signal/10" />
          <button
            type="button"
            onClick={closeCamera}
            className="absolute bottom-3 right-3 rounded-xl bg-black/70 px-3 py-1.5 text-xs text-white/80"
          >
            Close
          </button>
        </div>
      )}

      <form
        className="flex w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = textInput.trim();
          if (!v || busy) return;
          setTextInput("");
          void runChat(v);
        }}
      >
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={awake ? "Ask JARVIS..." : "Hello Jarvis"}
          className="flex-1 rounded-xl border border-white/10 bg-panel/80 px-4 py-3 text-sm text-white outline-none ring-signal/40 placeholder:text-mist/50 focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy || !textInput.trim()}
          className="rounded-xl bg-copper px-4 py-3 text-sm font-medium text-ink disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {error && (
        <p className="w-full rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-left text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="panel-glass w-full space-y-3 rounded-2xl px-4 py-3 text-left">
        {transcript ? (
          <p className="font-mono text-xs text-mist">
            <span className="text-signal/80">you · </span>
            {transcript}
          </p>
        ) : (
          <p className="font-mono text-xs text-mist/40">you · standing by</p>
        )}
        {reply ? (
          <p className="text-sm leading-relaxed text-white/90">
            <span className="font-mono text-xs text-copper">jarvis · </span>
            {reply}
          </p>
        ) : (
          <p className="text-sm text-mist/40">
            <span className="font-mono text-xs text-copper/50">jarvis · </span>
            ...
          </p>
        )}
      </div>

      {awake && intent && (
        <ActionPreview
          intent={intent}
          spendCap={spendCap}
          onClear={() => setIntent(null)}
          onResolved={(result) => {
            if (result.status === "confirmed") {
              pushActivity({
                userText: intent.summary || "action",
                assistantText: `Tx ${result.txHash}`,
                intentId: intent.id,
                txHash: result.txHash,
                status: "confirmed",
              });
              speak("Transaction submitted.");
            } else if (result.status === "rejected") {
              pushActivity({
                userText: intent.summary || "action",
                status: "rejected",
              });
            } else {
              pushActivity({
                userText: intent.summary || "action",
                status: "error",
                error: result.error,
              });
            }
            setIntent(null);
          }}
        />
      )}
    </div>
  );
}
