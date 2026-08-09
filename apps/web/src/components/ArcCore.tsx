"use client";

import { motion } from "framer-motion";

type Props = {
  listening?: boolean;
  busy?: boolean;
};

/** Arc-reactor style core — visual heartbeat of JARVIS */
export function ArcCore({ listening, busy }: Props) {
  const active = listening || busy;
  return (
    <div className="pointer-events-none relative mx-auto h-44 w-44 md:h-52 md:w-52">
      <motion.div
        className="absolute inset-0 rounded-full border border-cyan-400/25"
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-3 rounded-full border border-dashed border-amber-400/30"
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-8 rounded-full border border-cyan-300/40"
        animate={{ scale: active ? [1, 1.06, 1] : [1, 1.02, 1] }}
        transition={{ duration: active ? 0.9 : 2.4, repeat: Infinity }}
      />
      <div
        className={`absolute inset-12 rounded-full ${
          active ? "bg-cyan-400/25 shadow-[0_0_60px_rgba(34,211,238,0.55)]" : "bg-cyan-500/10"
        }`}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`h-10 w-10 rounded-full ${
            listening
              ? "bg-cyan-300 shadow-[0_0_30px_rgba(103,232,249,0.9)]"
              : busy
                ? "bg-amber-300 shadow-[0_0_28px_rgba(252,211,77,0.8)]"
                : "bg-cyan-500/70 shadow-[0_0_20px_rgba(34,211,238,0.45)]"
          }`}
        />
      </div>
      {[0, 45, 90, 135].map((deg) => (
        <motion.span
          key={deg}
          className="absolute left-1/2 top-1/2 h-px w-16 origin-left bg-gradient-to-r from-cyan-300/50 to-transparent"
          style={{ rotate: deg }}
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: deg / 180 }}
        />
      ))}
    </div>
  );
}
