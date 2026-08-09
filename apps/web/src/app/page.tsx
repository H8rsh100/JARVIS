"use client";

import { useAccount, useBalance, useChainId } from "wagmi";
import { Assistant } from "@/components/Assistant";
import { WalletButton } from "@/components/WalletButton";
import { motion } from "framer-motion";

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });
  const spendCap = process.env.NEXT_PUBLIC_SESSION_SPEND_CAP || "0.05";

  return (
    <main className="jarvis-atmosphere relative min-h-screen overflow-hidden">
      <div className="jarvis-grid absolute inset-0" />
      <div className="jarvis-noise absolute inset-0" />
      <div className="jarvis-vignette absolute inset-0 z-[1]" />
      <div className="jarvis-scan absolute inset-x-0 top-0 z-[2]" />

      <span className="hud-bracket hud-bracket-tl" />
      <span className="hud-bracket hud-bracket-tr" />
      <span className="hud-bracket hud-bracket-bl" />
      <span className="hud-bracket hud-bracket-br" />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold tracking-[0.12em] text-white md:text-2xl">
            JARVIS
          </span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-mist/70 sm:inline">
            local agent
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && balance && (
            <span className="hidden font-mono text-xs text-mist md:inline">
              {Number(balance.formatted).toFixed(4)} {balance.symbol}
            </span>
          )}
          <WalletButton />
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-5xl flex-col items-center justify-center px-5 pb-16 pt-6 text-center md:px-8">
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-[clamp(3.25rem,11vw,6.5rem)] font-bold leading-none tracking-[0.18em] text-white"
          style={{ textShadow: "0 0 40px rgba(61, 214, 198, 0.25)" }}
        >
          JARVIS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1 }}
          className="mt-5 max-w-xl text-base text-mist md:text-lg"
        >
          Speak. JARVIS runs it on your laptop.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10 w-full max-w-2xl"
        >
          <Assistant
            walletAddress={address}
            chainId={chainId}
            isConnected={isConnected}
            spendCap={spendCap}
          />
        </motion.div>
      </section>
    </main>
  );
}
