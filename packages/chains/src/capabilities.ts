import { baseSepolia, sepolia } from "viem/chains";
import { rootstockTestnet } from "./rootstock";

export type ChainKey = "sepolia" | "base-sepolia" | "rootstock-testnet";

export const chainByKey = {
  sepolia,
  "base-sepolia": baseSepolia,
  "rootstock-testnet": rootstockTestnet,
} as const;

export function explorerApiHint(chainKey: ChainKey): string {
  switch (chainKey) {
    case "sepolia":
      return "https://sepolia.etherscan.io";
    case "base-sepolia":
      return "https://sepolia.basescan.org";
    case "rootstock-testnet":
      return "https://explorer.testnet.rootstock.io";
  }
}

export function nativeSymbol(chainKey: ChainKey): string {
  return chainByKey[chainKey].nativeCurrency.symbol;
}

export function describeChainCapabilities(chainKey: ChainKey): {
  reads: boolean;
  transfers: boolean;
  swaps: boolean;
  deploy: boolean;
  notes: string;
} {
  const swaps = chainKey !== "rootstock-testnet";
  return {
    reads: true,
    transfers: true,
    swaps,
    deploy: true,
    notes: swaps
      ? "Full read/write + 0x swap quotes on this testnet."
      : "Reads, transfers, and deploys supported. Swap quotes unsupported on Rootstock in v1.",
  };
}
