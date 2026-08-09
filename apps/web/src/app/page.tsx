"use client";

import { useAccount, useBalance, useChainId } from "wagmi";
import { Assistant } from "@/components/Assistant";
import { WalletButton } from "@/components/WalletButton";
import { StarkHudRails } from "@/components/StarkHudRails";
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
      <div className="jarvis-blueprint absolute inset-0" />
      <div className="jarvis-noise absolute inset-0" />
      <div className="jarvis-vignette absolute inset-0 z-[1]" />
      <div className="jarvis-scan absolute inset-x-0 top-0 z-[2]" />

      <span className="hud-bracket hud-bracket-tl" />
      <span className="hud-bracket hud-bracket-tr" />
      <span className="hud-bracket hud-bracket-bl" />
      <span className="hud-bracket hud-bracket-br" />

      <StarkHudRails />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-bold tracking-[0.35em] text-signal md:text-base">
            J.A.R.V.I.S.
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

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-3xl flex-col items-center justify-center px-5 pb-14 pt-4 text-center">
        {/* Title sits ABOVE the reactor, not overlapping a random ring */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
          className="mb-2"
        >
          <h1 className="title-glow text-[clamp(2.75rem,9vw,4.75rem)] font-bold tracking-[0.28em] text-white">
            J.A.R.V.I.S.
          </h1>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.42em] text-signal/70">
            just a rather very intelligent system
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-8 w-full max-w-xl"
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
