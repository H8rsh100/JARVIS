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

type Props = {
  walletAddress?: Address;
  chainId: number;
  isConnected: boolean;
  spendCap: string;
};

const WAKE =
  /\b(hello|hey|hi|ok|okay)\s+jarvis\b|\bjarvis\s+(hello|hey|hi)\b/i;

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
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

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
      recognitionRef.current?.stop();
    };
  }, []);

  const runChat = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      if (!text) return;

      setBusy(true);
      setError(null);
      setStatus("");
      setTranscript(text);
      setReply("");

      if (!awake) {
        if (isWake(text)) {
          setAwake(true);
          const line = "Hello sir, ready to assist";
          setReply(line);
          pushActivity({ userText: text, assistantText: line, status: "info" });
          speak(line);
          setBusy(false);
          return;
        }
        setBusy(false);
        return;
      }

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
          const result = await executeLocalAction(local);
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
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(async () => {
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
      setError('Voice needs Chrome or Edge. Type "Hello Jarvis" instead.');
      return;
    }

    // Ask for mic permission first (avoids fake errors)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setError("Allow microphone access in the browser address bar, then try again.");
      return;
    }

    // Stop any previous session quietly
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognitionRef.current = recognition;
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

      // These are normal, not real failures
      if (code === "aborted" || code === "no-speech") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone blocked. Click the lock icon in the address bar and allow mic.");
        return;
      }
      if (code === "network") {
        setError("Speech needs internet in Chrome. Check connection, or just type.");
        return;
      }
      // Anything else: stay quiet unless it's audio-capture
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
    }
  }, [runChat]);

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
          className="absolute top-1/2 z-10 flex h-24 w-24 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-panel/85 shadow-glow backdrop-blur-md transition hover:border-signal/50 disabled:opacity-60"
          aria-label="Tap to talk"
        >
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-signal">
            {listening ? "listen" : busy ? "think" : "mic"}
          </span>
        </button>
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-mist/75">
        {listening
          ? "Listening..."
          : busy || status
            ? "Working..."
            : awake
              ? "Tap mic or type below"
              : 'Say "Hello Jarvis"'}
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

      {awake && (
        <div className="flex w-full flex-wrap justify-center gap-2">
          {["Open Chrome", "Open VS Code", "Open my project", "Open camera"].map(
            (hint) => (
            <button
              key={hint}
              type="button"
              disabled={busy}
              onClick={() => void runChat(hint)}
              className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-mist transition hover:border-signal/40 hover:text-white disabled:opacity-50"
            >
              {hint}
            </button>
          ))}
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

      <div className="w-full space-y-3 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3 text-left backdrop-blur-sm">
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
