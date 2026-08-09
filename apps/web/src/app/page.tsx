"use client";

import { useAccount, useBalance, useChainId } from "wagmi";
import { Assistant } from "@/components/Assistant";
import { WalletButton } from "@/components/WalletButton";
import { HudTicker } from "@/components/HudTicker";
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
      <div className="jarvis-scan absolute inset-x-0 top-0 z-[1]" />

      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl font-bold tracking-[0.2em] text-cyan-300 md:text-2xl">
            JARVIS
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300/70 sm:inline">
            mark · web3
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && balance && (
            <span className="hidden font-mono text-xs text-cyan-100/70 md:inline">
              {Number(balance.formatted).toFixed(4)} {balance.symbol}
            </span>
          )}
          <WalletButton />
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-5xl flex-col items-center justify-center px-5 pb-16 pt-4 text-center md:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-3 font-mono text-[11px] uppercase tracking-[0.4em] text-cyan-300/80"
        >
          how may I assist you, sir?
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-display text-[clamp(2.8rem,10vw,5.5rem)] font-bold tracking-[0.12em] text-white"
        >
          JARVIS
        </motion.h1>

        <HudTicker />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-5 max-w-lg text-base text-slate-300 md:text-lg"
        >
          Voice-driven chain ops. I prepare the action. You confirm the signature.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.65 }}
          className="mt-8 w-full max-w-2xl"
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
