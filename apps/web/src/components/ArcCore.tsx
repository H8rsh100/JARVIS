"use client";

import { motion } from "framer-motion";

type Props = { listening?: boolean; busy?: boolean };

/** Clean centered arc-reactor. All rings share the same center. */
export function ArcCore({ listening, busy }: Props) {
  const hot = listening || busy;

  return (
    <div className="relative mx-auto h-[240px] w-[240px]">
      {/* outermost dashed */}
      <div className="absolute inset-0 rounded-full border border-dashed border-signal/25" />

      {/* slow outer arc */}
      <motion.div
        className="absolute inset-3 rounded-full border-[3px] border-transparent"
        style={{
          borderTopColor: "rgba(61,214,198,0.75)",
          borderRightColor: "rgba(61,214,198,0.15)",
          transformOrigin: "center center",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* counter copper arc */}
      <motion.div
        className="absolute inset-7 rounded-full border-2 border-transparent"
        style={{
          borderBottomColor: "rgba(196,122,58,0.7)",
          borderLeftColor: "rgba(196,122,58,0.2)",
          transformOrigin: "center center",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      />

      {/* mid ring */}
      <div className="absolute inset-12 rounded-full border border-signal/30" />

      {/* tick ring */}
      <div className="absolute inset-[3.25rem] rounded-full border border-signal/20" />
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 h-0.5 w-2 -translate-y-1/2 bg-signal/50"
          style={{
            transformOrigin: "0 50%",
            transform: `rotate(${i * 30}deg) translateX(78px)`,
          }}
        />
      ))}

      {/* inner pulse ring */}
      <motion.div
        className="absolute inset-[5.25rem] rounded-full border border-signal/50"
        animate={{ opacity: hot ? [0.4, 1, 0.4] : [0.35, 0.6, 0.35], scale: hot ? [1, 1.04, 1] : 1 }}
        transition={{ duration: hot ? 0.9 : 2.6, repeat: Infinity }}
        style={{ transformOrigin: "center center" }}
      />

      {/* core glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className={`h-14 w-14 rounded-full ${
            listening
              ? "bg-signal shadow-[0_0_36px_rgba(61,214,198,0.95)]"
              : busy
                ? "bg-copper shadow-[0_0_32px_rgba(196,122,58,0.85)]"
                : "bg-signal/80 shadow-[0_0_24px_rgba(61,214,198,0.55)]"
          }`}
          animate={listening ? { scale: [1, 1.08, 1] } : {}}
          transition={{ duration: 0.85, repeat: Infinity }}
        />
      </div>
    </div>
  );
}
