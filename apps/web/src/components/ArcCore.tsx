"use client";

import { motion } from "framer-motion";

type Props = { listening?: boolean; busy?: boolean };

/** Arc-reactor core on top of the existing layout */
export function ArcCore({ listening, busy }: Props) {
  const active = listening || busy;
  return (
    <div className="relative mx-auto h-44 w-44 md:h-48 md:w-48">
      <motion.div
        className="absolute inset-0 rounded-full border border-signal/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-3 rounded-full border border-white/[0.07]"
        animate={{ rotate: -360 }}
        transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-7 rounded-full border border-dashed border-copper/25"
        animate={{ rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute inset-12 rounded-full border border-signal/35"
        animate={{ scale: active ? [1, 1.05, 1] : [1, 1.015, 1] }}
        transition={{ duration: active ? 0.85 : 2.6, repeat: Infinity }}
      />
      <div
        className={`absolute inset-[3.75rem] rounded-full md:inset-16 ${
          active ? "bg-signal/20 shadow-glow" : "bg-signal/[0.08]"
        }`}
      />
      {/* tick marks */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <span
          key={deg}
          className="absolute left-1/2 top-1/2 h-[2px] w-2.5 origin-left bg-signal/30"
          style={{ transform: `rotate(${deg}deg) translateX(4.6rem)` }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className={`h-10 w-10 rounded-full ${
            listening
              ? "bg-signal shadow-[0_0_32px_rgba(61,214,198,0.95)]"
              : busy
                ? "bg-copper shadow-[0_0_28px_rgba(196,122,58,0.8)]"
                : "bg-signal/75 shadow-[0_0_20px_rgba(61,214,198,0.45)]"
          }`}
          animate={listening ? { scale: [1, 1.14, 1] } : {}}
          transition={{ duration: 0.75, repeat: Infinity }}
        />
      </div>
    </div>
  );
}
