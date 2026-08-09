"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function BootSequence({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setShow(false);
      onDone();
    }, 1400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050608]"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
        >
          <motion.h1
            className="font-display text-5xl font-semibold tracking-wide text-white md:text-6xl"
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.7 }}
          >
            JARVIS
          </motion.h1>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
