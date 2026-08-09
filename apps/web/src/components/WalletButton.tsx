"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia, baseSepolia, rootstockTestnet } from "@jarvis/chains";

const chains = [sepolia, baseSepolia, rootstockTestnet];

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={isPending || !connectors[0]}
          onClick={() => connectors[0] && connect({ connector: connectors[0] })}
          className="rounded-xl bg-signal px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
        >
          {isPending ? "Connecting..." : "Connect wallet"}
        </button>
        {error?.message.includes("Provider not found") && (
          <span className="font-mono text-[10px] text-red-300">Install MetaMask</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded-lg border border-white/10 bg-panel px-2 py-2 font-mono text-[11px] text-mist"
        value={chain?.id ?? sepolia.id}
        onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
      >
        {chains.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => disconnect()}
        className="rounded-xl border border-white/15 px-3 py-2 font-mono text-[11px] text-mist"
        title={address}
      >
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </button>
    </div>
  );
}
