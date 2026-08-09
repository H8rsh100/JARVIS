"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useChainId } from "wagmi";
import { Assistant } from "@/components/Assistant";
import { motion } from "framer-motion";
import { hasValidWalletConnectId } from "@/lib/wagmi";

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

      <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-2xl tracking-wide text-white md:text-3xl">
            JARVIS
          </span>
          <span className="hidden text-xs uppercase tracking-[0.2em] text-mist/80 sm:inline">
            voice web3
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!hasValidWalletConnectId && (
            <span className="hidden max-w-[14rem] truncate font-mono text-[10px] text-amber-200/80 md:inline">
              set WalletConnect project id for WC
            </span>
          )}
          {isConnected && balance && (
            <span className="hidden font-mono text-xs text-mist md:inline">
              {Number(balance.formatted).toFixed(4)} {balance.symbol}
            </span>
          )}
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-5xl flex-col items-center justify-center px-5 pb-16 pt-6 text-center md:px-8">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-4 font-mono text-[11px] uppercase tracking-[0.35em] text-signal/90"
        >
          always confirm before you sign
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="font-display text-[clamp(3.5rem,12vw,7.5rem)] leading-[0.9] text-white"
        >
          JARVIS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.15 }}
          className="mt-5 max-w-xl text-base text-mist md:text-lg"
        >
          Speak a chain action. JARVIS prepares it. You confirm in your wallet.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25 }}
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
