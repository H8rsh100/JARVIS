"use client";

import type { ActivityItem } from "@jarvis/agent";
import { explorerTxUrl } from "@jarvis/chains";
import { useChainId } from "wagmi";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const chainId = useChainId();

  if (!items.length) {
    return (
      <div className="w-full rounded-2xl border border-dashed border-white/10 px-4 py-6 text-left">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist/50">
          activity
        </p>
        <p className="mt-2 text-sm text-mist/70">Session history will appear here.</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mist/50">activity</p>
      <ul className="mt-3 max-h-56 space-y-3 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.id} className="border-b border-white/5 pb-3 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase text-signal/80">{item.status}</span>
              <span className="font-mono text-[10px] text-mist/40">
                {new Date(item.at).toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/90">{item.userText}</p>
            {item.assistantText && (
              <p className="mt-1 text-xs text-mist">{item.assistantText}</p>
            )}
            {item.txHash && (
              <a
                className="mt-1 inline-block font-mono text-[11px] text-copper underline-offset-2 hover:underline"
                href={explorerTxUrl(chainId, item.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                {item.txHash.slice(0, 10)}…{item.txHash.slice(-6)}
              </a>
            )}
            {item.error && <p className="mt-1 text-xs text-red-300">{item.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
