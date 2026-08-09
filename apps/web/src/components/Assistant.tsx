"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import type { ActivityItem, UnsignedIntent } from "@jarvis/agent";
import { ActionPreview } from "@/components/ActionPreview";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ArcCore } from "@/components/ArcCore";

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
      if (res.ok && res.status !== 204) {
        const blob = await res.blob();
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await audio.play();
          URL.revokeObjectURL(url);
          return;
        }
      }
    } catch {
      /* fall through to browser TTS */
    }
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text.slice(0, 900));
        utter.rate = 1.02;
        window.speechSynthesis.speak(utter);
      }
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
    <div className="flex w-full flex-col items-center gap-5">
      <div className="relative flex flex-col items-center">
        <ArcCore listening={listening} busy={busy} />
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
          className="absolute top-1/2 z-10 flex h-24 w-24 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/40 bg-slate-950/50 backdrop-blur-sm transition hover:border-cyan-200 disabled:opacity-60"
          aria-label="Hold to talk"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200">
            {listening ? "listen" : busy ? "think" : "hold"}
          </span>
        </button>
      </div>

      <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-200/60">
        Hold to talk · or type below
      </p>

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
            className="rounded border border-cyan-500/25 bg-cyan-950/30 px-3 py-1.5 font-mono text-[11px] text-cyan-100/80 transition hover:border-cyan-300/50 hover:text-white disabled:opacity-50"
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
          className="flex-1 rounded border border-cyan-500/30 bg-slate-950/70 px-4 py-3 font-sans text-sm text-white outline-none ring-cyan-400/30 placeholder:text-slate-500 focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy || !textInput.trim()}
          className="rounded bg-cyan-400 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 disabled:opacity-50"
        >
          Send
        </button>
      </form>

      <div className="w-full space-y-2 text-left">
        {transcript && (
          <p className="font-mono text-xs text-slate-400">
            <span className="text-cyan-300/80">you · </span>
            {transcript}
          </p>
        )}
        {reply && (
          <p className="text-sm leading-relaxed text-cyan-50/95">
            <span className="font-mono text-xs text-amber-300">jarvis · </span>
            {reply}
          </p>
        )}
        {error && (
          <p className="rounded border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <p className="font-mono text-[10px] text-slate-500">
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
