"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ActivityItem } from "@jarvis/agent";
import { ArcCore } from "@/components/ArcCore";
import { ConfirmPanel } from "@/components/ConfirmPanel";
import {
  agentHealth,
  executeLocalAction,
  parseLocalAction,
  type LocalAction,
} from "@/lib/localActions";
import {
  CAPABILITIES_FULL,
  CAPABILITIES_SPOKEN,
  isCapabilitiesQuestion,
} from "@/lib/capabilities";
import { formatISTReply, isDateTimeQuestion } from "@/lib/datetime";
import { handleMemoryCommand, loadMemory } from "@/lib/memory";

const WAKE = /^\s*(hey|hi|hello)\s*,?\s*jarvis\s*[.!?]?\s*$/i;
const HOT_MS = 45_000;

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
type SRCtor = new () => Rec;

let jarvisVoice: SpeechSynthesisVoice | null = null;
function pickJarvisVoice(): SpeechSynthesisVoice | null {
  if (jarvisVoice) return jarvisVoice;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  jarvisVoice =
    voices.find((v) => /^ryan$/i.test(v.name) && /en[-_]GB/i.test(v.lang)) ||
    voices.find(
      (v) =>
        /en[-_]GB/i.test(v.lang) &&
        /daniel|arthur|oliver|george|male/i.test(v.name),
    ) ||
    voices.find((v) => /google uk english male/i.test(v.name)) ||
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
    null;
  return jarvisVoice;
}

function isWake(text: string) {
  return WAKE.test(text.trim());
}

export function Assistant() {
  const [awake, setAwake] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState("");
  const [hotUntil, setHotUntil] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState<{
    action: LocalAction;
    userText: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(
    null,
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordModeRef = useRef(false);
  const awakeRef = useRef(false);
  const hotUntilRef = useRef(0);
  const busyRef = useRef(false);
  const replyRef = useRef("");
  const listenSoonTimer = useRef<number | null>(null);
  const startListeningRef = useRef<() => void>(() => {});
  const guardRef = useRef<Rec | null>(null);
  const guardWantedRef = useRef(false);
  const wakeAtRef = useRef(0);
  const guardStartRef = useRef<() => void>(() => {});
  const guardStopRef = useRef<() => void>(() => {});
  const [guardOn, setGuardOn] = useState(false);

  useEffect(() => {
    awakeRef.current = awake;
  }, [awake]);
  useEffect(() => {
    hotUntilRef.current = hotUntil;
  }, [hotUntil]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    replyRef.current = reply;
  }, [reply]);

  const bumpHot = useCallback(() => {
    const until = Date.now() + HOT_MS;
    hotUntilRef.current = until;
    setHotUntil(until);
  }, []);

  const pushActivity = useCallback(
    (item: Omit<ActivityItem, "id" | "at"> & { id?: string }) => {
      const full: ActivityItem = {
        id: item.id || `act_${Date.now()}`,
        at: Date.now(),
        userText: item.userText,
        assistantText: item.assistantText,
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
        const voice = pickJarvisVoice();
        if (voice) utter.voice = voice;
        utter.rate = 0.98;
        utter.pitch = 0.9;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      /* optional */
    }
  }, []);

  const scheduleHotListen = useCallback(() => {}, []);

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
      if (listenSoonTimer.current) window.clearTimeout(listenSoonTimer.current);
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
      try {
        guardRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const runLocal = useCallback(
    async (local: LocalAction, userText: string, confirmed = false) => {
      setStatus("working");
      const online = await agentHealth();
      if (!online) {
        const line =
          "Desktop agent is offline. Run jarvis.cmd (keep agent warm).";
        setReply(line);
        setError(line);
        pushActivity({ userText, assistantText: line, status: "error" });
        speak(line);
        setBusy(false);
        setStatus("");
        return;
      }

      if (local.risky && !confirmed) {
        setPendingConfirm({ action: local, userText });
        setBusy(false);
        setStatus("");
        setReply(`Confirm: ${local.summary}?`);
        return;
      }

      try {
        let action = local;
        if (local.kind === "clipboard_set" && local.target === "last_reply") {
          const last = replyRef.current?.trim();
          if (!last) {
            const line = "Nothing to copy yet.";
            setReply(line);
            speak(line);
            setBusy(false);
            setStatus("");
            bumpHot();
            scheduleHotListen();
            return;
          }
          action = { ...local, text: last };
        }

        const result = await executeLocalAction(action, {
          confirm: local.risky === true,
        });
        if (!result.ok) throw new Error(result.error || "Action failed");

        let line = result.did || local.summary;
        if (local.kind === "clipboard_get") {
          const clip = (result.text || "").trim();
          line = clip
            ? `Clipboard: ${clip.slice(0, 280)}`
            : "Clipboard is empty.";
        }
        setReply(line);
        pushActivity({ userText, assistantText: line, status: "info" });
        speak(line);
        bumpHot();
        scheduleHotListen();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Local action failed";
        setError(msg);
        setReply(msg);
        pushActivity({ userText, status: "error", error: msg });
        speak(msg);
      } finally {
        setBusy(false);
        setStatus("");
      }
    },
    [bumpHot, pushActivity, scheduleHotListen, speak],
  );

  const runChat = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      if (!text) return;

      if (!awake) {
        if (!isWake(text)) return;
        setBusy(true);
        setError(null);
        setStatus("");
        setTranscript(text);
        setAwake(true);
        awakeRef.current = true;
        guardWantedRef.current = false;
        guardStopRef.current();
        const mem = loadMemory();
        const line = mem.name
          ? `Hello ${mem.name}, ready to assist`
          : "Hello sir, ready to assist";
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(line);
        setBusy(false);
        bumpHot();
        scheduleHotListen();
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
        bumpHot();
        scheduleHotListen();
        return;
      }
      if (/close (the )?camera|stop camera|hide camera|disable camera/i.test(text)) {
        closeCamera();
        const line = "Camera feed closed.";
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(line);
        setBusy(false);
        bumpHot();
        scheduleHotListen();
        return;
      }
      if (/go (to )?sleep|standby|good ?night jarvis|lock jarvis/i.test(text)) {
        closeCamera();
        setAwake(false);
        awakeRef.current = false;
        setHotUntil(0);
        hotUntilRef.current = 0;
        const line = "Entering standby.";
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(line);
        setBusy(false);
        guardWantedRef.current = true;
        void guardStartRef.current();
        return;
      }

      if (isCapabilitiesQuestion(text)) {
        const line = CAPABILITIES_FULL;
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(CAPABILITIES_SPOKEN);
        setBusy(false);
        bumpHot();
        scheduleHotListen();
        return;
      }

      const when = isDateTimeQuestion(text);
      if (when) {
        const line = formatISTReply(when);
        setReply(line);
        pushActivity({ userText: text, assistantText: line, status: "info" });
        speak(line);
        setBusy(false);
        bumpHot();
        scheduleHotListen();
        return;
      }

      const memCmd = handleMemoryCommand(text);
      if (memCmd) {
        if (memCmd.openPath) {
          await runLocal(
            {
              kind: "open_path",
              target: memCmd.openPath,
              summary: `Open ${memCmd.openPath}`,
            },
            text,
          );
          return;
        }
        setReply(memCmd.reply);
        pushActivity({
          userText: text,
          assistantText: memCmd.reply,
          status: "info",
        });
        speak(memCmd.reply);
        setBusy(false);
        bumpHot();
        scheduleHotListen();
        return;
      }

      const local = parseLocalAction(text);
      if (local) {
        await runLocal(local, text);
        return;
      }

      pushActivity({ userText: text, status: "pending" });
      setStatus("working");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Chat failed" }));
          throw new Error(err.error || "Chat failed");
        }

        const data = (await res.json()) as { text: string };

        setReply(data.text || "");
        pushActivity({
          userText: text,
          assistantText: data.text,
          status: "info",
        });
        if (data.text) speak(data.text);
        bumpHot();
        scheduleHotListen();
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
    [
      awake,
      pushActivity,
      speak,
      openCamera,
      closeCamera,
      bumpHot,
      scheduleHotListen,
      runLocal,
    ],
  );

  const stopListening = useCallback(() => {
    if (recordModeRef.current && mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
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

  const startRecordListen = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined") {
      setError("Audio recording not supported here. Type instead.");
      return;
    }

    try {
      const statusRes = await fetch("/api/transcribe", { cache: "no-store" });
      const status = (await statusRes.json()) as {
        ok?: boolean;
        hint?: string;
      };
      if (!status.ok) {
        setError(
          status.hint ||
            "Tray mic needs a Google AIza key — or use jarvis.cmd (Chrome mic).",
        );
        return;
      }
    } catch {
      setError("Web UI not reachable for transcription.");
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
        if (!chunks.length) {
          setError("No audio captured. Tap mic and speak.");
          return;
        }

        const raw = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        if (raw.size < 800) {
          setError("Recording too short. Tap mic and speak.");
          return;
        }

        setBusy(true);
        setStatus("working");
        setError(null);
        try {
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
            setError("Did not catch that. Tap mic again.");
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

      recorder.start(250);
      window.setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
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
      void startRecordListen();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setError("Allow microphone access in Chrome’s address bar, then try again.");
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

      if (code === "aborted") return;
      if (code === "no-speech") {
        if (awakeRef.current && Date.now() < hotUntilRef.current) {
          scheduleHotListen();
        }
        return;
      }
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError(
          "Microphone blocked. Click the lock icon in Chrome → allow mic.",
        );
        return;
      }
      if (code === "network") {
        const inElectron = navigator.userAgent.includes("Electron");
        if (inElectron) {
          void startRecordListen();
          return;
        }
        setError("Chrome speech needs internet. Check Wi‑Fi, or type.");
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
  }, [runChat, scheduleHotListen, startRecordListen]);

  const startListening = useCallback(async () => {
    const inElectron = navigator.userAgent.includes("Electron");
    if (inElectron) {
      await startRecordListen();
      return;
    }
    await startWebSpeechListen();
  }, [startRecordListen, startWebSpeechListen]);

  useEffect(() => {
    startListeningRef.current = () => {
      void startListening();
    };
  }, [startListening]);

  const toggleListening = useCallback(() => {
    if (busy) return;
    if (listening) stopListening();
    else void startListening();
  }, [busy, listening, startListening, stopListening]);

  const stopGuard = useCallback(() => {
    guardWantedRef.current = false;
    try {
      guardRef.current?.stop();
    } catch {
      /* ignore */
    }
    guardRef.current = null;
    setGuardOn(false);
  }, []);

  const startGuard = useCallback(async () => {
    if (!guardWantedRef.current) return;
    if (awakeRef.current || busyRef.current) return;
    if (recognitionRef.current || mediaRecorderRef.current) return;
    if (guardRef.current) return;

    const w = window as unknown as {
      SpeechRecognition?: SRCtor;
      webkitSpeechRecognition?: SRCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError("Voice guard needs Chrome or Edge. Tap mic to talk instead.");
      guardWantedRef.current = false;
      return;
    }

    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = true;
    guardRef.current = rec;

    rec.onresult = (event) => {
      const said = event.results?.[0]?.[0]?.transcript?.trim();
      if (said && isWake(said)) {
        wakeAtRef.current = Date.now();
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
        void runChat(said);
      }
    };

    rec.onerror = (event) => {
      const code = event.error || "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError(
          "Guard needs mic permission. Allow mic in the address bar, then tap Guard.",
        );
        guardWantedRef.current = false;
        guardRef.current = null;
        setGuardOn(false);
      } else if (code === "audio-capture") {
        setError("No microphone found for guard mode.");
        guardWantedRef.current = false;
        guardRef.current = null;
        setGuardOn(false);
      }
    };

    rec.onend = () => {
      guardRef.current = null;
      const justWoke = Date.now() - wakeAtRef.current < 2500;
      if (guardWantedRef.current && !justWoke && !awakeRef.current) {
        window.setTimeout(() => guardStartRef.current(), 700);
      } else if (!justWoke && !awakeRef.current) {
        setGuardOn(false);
      }
    };

    try {
      rec.start();
      setGuardOn(true);
    } catch {
      guardRef.current = null;
      window.setTimeout(() => guardStartRef.current(), 1200);
    }
  }, [runChat]);

  useEffect(() => {
    guardStartRef.current = () => {
      void startGuard();
    };
    guardStopRef.current = stopGuard;
  }, [startGuard, stopGuard]);

  useEffect(() => {
    guardWantedRef.current = true;
    void startGuard();
  }, [startGuard]);

  const hotLeft = Math.max(0, hotUntil - Date.now());

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {pendingConfirm && (
        <ConfirmPanel
          title={pendingConfirm.action.summary}
          detail="This affects your PC or an app window. Tony would want a confirm."
          confirmLabel="Execute"
          onCancel={() => {
            setPendingConfirm(null);
            setReply("Cancelled.");
            speak("Cancelled.");
            bumpHot();
            scheduleHotListen();
          }}
          onConfirm={() => {
            const { action, userText } = pendingConfirm;
            setPendingConfirm(null);
            setBusy(true);
            void runLocal(action, userText, true);
          }}
        />
      )}

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
              ? "Working..."
              : "Working..."
            : awake
              ? hotLeft > 0
                ? `Online · hot ${Math.ceil(hotLeft / 1000)}s`
                : "Online"
              : guardOn
                ? "Guard armed · say Hey Jarvis"
                : "Standby"}
      </p>

      {!awake && (
        <button
          type="button"
          onClick={() => {
            if (guardOn) {
              guardStopRef.current();
            } else {
              guardWantedRef.current = true;
              void guardStartRef.current();
            }
          }}
          className="rounded-full border border-signal/30 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-signal/80 hover:border-signal/60"
        >
          guard · {guardOn ? "armed" : "off"}
        </button>
      )}

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
          placeholder={awake ? "Ask JARVIS..." : "Say or type: Hey Jarvis"}
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
          <p className="font-mono text-xs text-mist/40">jarvis · ...</p>
        )}
      </div>

      {activity.length > 0 && (
        <div className="w-full space-y-2 text-left">
          {activity.slice(0, 6).map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 font-mono text-[11px] text-mist/70"
            >
              {a.userText && (
                <div>
                  <span className="text-signal/70">you · </span>
                  {a.userText}
                </div>
              )}
              {(a.assistantText || a.error) && (
                <div className="mt-0.5">
                  <span className="text-copper/80">jarvis · </span>
                  {a.error || a.assistantText}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-mist/35">
        suit.uplink · voice.parser · action.runner
      </p>
    </div>
  );
}
