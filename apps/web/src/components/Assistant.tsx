"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Address } from "viem";
import type { ActivityItem, UnsignedIntent } from "@jarvis/agent";
import { ActionPreview } from "@/components/ActionPreview";
import { ActivityFeed } from "@/components/ActivityFeed";

type Props = {
  walletAddress?: Address;
  chainId: number;
  isConnected: boolean;
  spendCap: string;
};

export function Assistant({
  walletAddress,
  chainId,
  isConnected,
  spendCap,
}: Props) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [intent, setIntent] = useState<UnsignedIntent | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const pushActivity = useCallback((item: Omit<ActivityItem, "id" | "at"> & { id?: string }) => {
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
    return full;
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
      URL.revokeObjectURL(url);
    } catch {
      /* TTS optional */
    }
  }, []);

  const runChat = useCallback(
    async (userText: string) => {
      setBusy(true);
      setError(null);
      setReply("");
      setTranscript(userText);
      pushActivity({ userText, status: "pending" });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
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

        setReply(data.text);
        if (data.intent) setIntent(data.intent);

        pushActivity({
          userText,
          assistantText: data.text,
          intentId: data.intent?.id,
          status: data.intent ? "pending" : "info",
        });

        if (data.text) void speak(data.text);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        pushActivity({ userText, status: "error", error: msg });
        void speak(`Error. ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [walletAddress, chainId, pushActivity, speak],
  );

  const stopListening = useCallback(() => {
    const rec = mediaRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) {
          setError("No audio captured. Hold the mic and speak.");
          return;
        }
        setBusy(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "speech.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Transcription failed" }));
            throw new Error(err.error || "Transcription failed");
          }
          const { text } = (await res.json()) as { text: string };
          if (!text?.trim()) {
            setError("Could not understand audio. Try again.");
            setBusy(false);
            return;
          }
          await runChat(text.trim());
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Mic error";
          setError(msg);
          setBusy(false);
        }
      };

      recorder.start();
      setListening(true);
    } catch {
      setError("Microphone permission denied.");
    }
  }, [runChat]);

  useEffect(() => {
    return () => {
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="relative">
        <AnimatePresence>
          {listening && (
            <motion.span
              className="absolute inset-0 -m-3 rounded-full border border-signal/40"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0.4, 0.9, 0.4], scale: [1, 1.12, 1] }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.4 }}
            />
          )}
        </AnimatePresence>
        <button
          type="button"
          disabled={busy}
          onMouseDown={() => void startListening()}
          onMouseUp={stopListening}
          onMouseLeave={() => listening && stopListening()}
          onTouchStart={(e) => {
            e.preventDefault();
            void startListening();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopListening();
          }}
          className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-panel/80 shadow-glow backdrop-blur-md transition hover:border-signal/50 disabled:opacity-60"
          aria-label="Hold to talk"
        >
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-signal">
            {listening ? "listen" : busy ? "think" : "hold"}
          </span>
        </button>
      </div>

      <p className="text-sm text-mist/80">Hold to talk · or type below</p>

      <div className="flex w-full flex-wrap justify-center gap-2">
        {[
          "Check my balance on Base",
          "What can you do on Rootstock?",
          "Show my recent transfers on Sepolia",
        ].map((hint) => (
          <button
            key={hint}
            type="button"
            disabled={busy}
            onClick={() => void runChat(hint)}
            className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-mist transition hover:border-signal/40 hover:text-white disabled:opacity-50"
          >
            {hint}
          </button>
        ))}
      </div>

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
          placeholder={
            isConnected
              ? 'e.g. "check my balance on Base"'
              : "Connect wallet, then ask JARVIS…"
          }
          className="flex-1 rounded-xl border border-white/10 bg-panel/70 px-4 py-3 text-sm text-white outline-none ring-signal/40 placeholder:text-mist/50 focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy || !textInput.trim()}
          className="rounded-xl bg-copper px-4 py-3 text-sm font-medium text-ink disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <div className="w-full space-y-2 text-left">
        {transcript && (
          <p className="font-mono text-xs text-mist">
            <span className="text-signal/80">you · </span>
            {transcript}
          </p>
        )}
        {reply && (
          <p className="text-sm leading-relaxed text-white/90">
            <span className="font-mono text-xs text-copper">jarvis · </span>
            {reply}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <p className="font-mono text-[10px] text-mist/60">
          session soft cap · {spendCap} native · chainId {chainId || "—"}
        </p>
      </div>

      <ActionPreview
        intent={intent}
        spendCap={spendCap}
        onClear={() => setIntent(null)}
        onResolved={(result) => {
          if (result.status === "confirmed") {
            pushActivity({
              userText: intent?.summary || "action",
              assistantText: `Tx ${result.txHash}`,
              intentId: intent?.id,
              txHash: result.txHash,
              status: "confirmed",
            });
            void speak("Transaction submitted.");
          } else if (result.status === "rejected") {
            pushActivity({
              userText: intent?.summary || "action",
              status: "rejected",
            });
          } else {
            pushActivity({
              userText: intent?.summary || "action",
              status: "error",
              error: result.error,
            });
          }
          setIntent(null);
        }}
      />

      <ActivityFeed items={activity} />
    </div>
  );
}
