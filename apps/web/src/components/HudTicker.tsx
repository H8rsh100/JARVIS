"use client";

import { motion } from "framer-motion";

const LINES = [
  "SYSTEM ONLINE",
  "VOICE LINK STANDBY",
  "CHAIN ROUTER READY",
  "CONFIRM-GATE ARMED",
  "NO KEY CUSTODY",
];

export function HudTicker() {
  return (
    <div className="relative mx-auto mt-4 w-full max-w-xl overflow-hidden border-y border-cyan-500/20 py-2">
      <motion.div
        className="flex whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/70"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      >
        {[...LINES, ...LINES].map((line, i) => (
          <span key={`${line}-${i}`} className="mx-6">
            ◆ {line}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
