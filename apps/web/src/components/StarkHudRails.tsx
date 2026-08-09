"use client";

import { motion } from "framer-motion";
import { NeuralCore } from "@/components/NeuralCore";

const LEFT = [
  "SYS.CORE // ONLINE",
  "VOICE.LINK // ARMED",
  "AGENT.HOST // 127.0.0.1",
  "WAKE.PHRASE // HELLO JARVIS",
  "CONFIRM.GATE // ENABLED",
  "CAM.FEED // STANDBY",
];

const RIGHT = [
  "PWR ████████░░ 82%",
  "LAT ████░░░░░░ 41ms",
  "NET ██████████ LIVE",
  "CPU ██████░░░░ 63%",
  "MEM █████░░░░░ 54%",
  "THR ░░░░░░░░░░ LOW",
];

export function StarkHudRails() {
  return (
    <>
      {/* left telemetry — suit sits in the gap above ARC.MATRIX */}
      <aside className="pointer-events-none absolute bottom-28 left-4 top-24 z-[3] hidden w-40 flex-col xl:flex xl:left-6">
        <div className="shrink-0 space-y-1.5 border-l border-signal/30 pl-3">
          <p className="font-mono text-[9px] tracking-[0.35em] text-signal/80">TELEMETRY</p>
          {LEFT.map((line, i) => (
            <motion.p
              key={line}
              className="font-mono text-[10px] leading-relaxed text-mist/70"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i }}
            >
              {line}
            </motion.p>
          ))}
        </div>

        {/* fills the gap between telemetry and matrix; flush left, clear of top/bottom blocks */}
        <div className="my-2 flex min-h-0 flex-1 items-center justify-start overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/suit-hud.png"
            alt=""
            width={546}
            height={1473}
            className="h-full max-h-[295px] w-auto max-w-[148px] object-contain object-left"
            draggable={false}
          />
        </div>

        <div className="shrink-0 border border-signal/20 bg-black/40 p-3 backdrop-blur-sm">
          <p className="mb-2 font-mono text-[9px] tracking-[0.3em] text-copper/90">ARC.MATRIX</p>
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 16 }).map((_, i) => (
              <motion.span
                key={i}
                className="h-2 w-full bg-signal/25"
                animate={{ opacity: [0.25, 0.9, 0.25] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.07 }}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* right gauges — orb sits in the gap above CORE dial */}
      <aside className="pointer-events-none absolute bottom-28 right-4 top-24 z-[3] hidden w-44 flex-col xl:flex xl:right-8 xl:w-52">
        <div className="shrink-0 space-y-1.5 border-r border-signal/30 pr-3 text-right">
          <p className="font-mono text-[9px] tracking-[0.35em] text-signal/80">DIAGNOSTICS</p>
          {RIGHT.map((line, i) => (
            <motion.p
              key={line}
              className="font-mono text-[10px] leading-relaxed text-mist/70"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i }}
            >
              {line}
            </motion.p>
          ))}
        </div>

        {/* neural core — fills the gap, mirrors left suit image */}
        <div className="my-2 flex min-h-0 flex-1 items-center justify-end overflow-hidden pr-1">
          <NeuralCore />
        </div>

        {/* core ring bottom */}
        <div className="relative ml-auto h-28 w-28 shrink-0">
          <div className="absolute inset-0 rounded-full border border-signal/25" />
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-transparent"
            style={{
              borderTopColor: "rgba(61,214,198,0.7)",
              borderRightColor: "rgba(61,214,198,0.2)",
              transformOrigin: "center",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-[9px] text-signal/70">CORE</span>
            <span className="font-mono text-sm text-signal">100%</span>
          </div>
        </div>
      </aside>

      {/* top thin data strip */}
      <div className="pointer-events-none absolute left-1/2 top-16 z-[3] hidden -translate-x-1/2 items-center gap-6 font-mono text-[9px] tracking-[0.25em] text-mist/50 md:flex">
        <span>CH-01</span>
        <span className="text-signal/60">●</span>
        <span>STARK.OS</span>
        <span className="text-signal/60">●</span>
        <span>LOCAL.ONLY</span>
        <span className="text-signal/60">●</span>
        <span>NO.CLOUD.KEYS</span>
      </div>

      {/* bottom schematic line */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-[3] hidden w-[min(70vw,640px)] -translate-x-1/2 md:block">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-signal/40 to-transparent" />
        </div>
        <p className="mt-2 text-center font-mono text-[9px] tracking-[0.35em] text-mist/40">
          SUIT.UPLINK · VOICE.PARSER · ACTION.RUNNER
        </p>
      </div>
    </>
  );
}
