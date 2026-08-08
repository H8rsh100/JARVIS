import { baseSepolia, sepolia } from "viem/chains";
import { rootstockTestnet } from "./rootstock";
import type { ChainKey } from "./capabilities";

export { rootstockTestnet };
export * from "./capabilities";

export const supportedChains = [sepolia, baseSepolia, rootstockTestnet] as const;

export type SupportedChainId = (typeof supportedChains)[number]["id"];

export type { ChainKey };

export const chainByKey: Record<ChainKey, (typeof supportedChains)[number]> = {
  sepolia,
  "base-sepolia": baseSepolia,
  "rootstock-testnet": rootstockTestnet,
};

export const chainKeyById: Record<number, ChainKey> = {
  [sepolia.id]: "sepolia",
  [baseSepolia.id]: "base-sepolia",
  [rootstockTestnet.id]: "rootstock-testnet",
};

export function resolveChainKey(input: string): ChainKey | null {
  const n = input.trim().toLowerCase();
  if (["sepolia", "eth", "ethereum", "ethereum sepolia"].includes(n)) return "sepolia";
  if (["base", "base sepolia", "base-sepolia"].includes(n)) return "base-sepolia";
  if (["rootstock", "rsk", "rootstock testnet", "rbtc"].includes(n))
    return "rootstock-testnet";
  if (n === "sepolia" || n === "base-sepolia" || n === "rootstock-testnet") return n;
  return null;
}

export function explorerTxUrl(chainId: number, hash: string): string {
  const chain = supportedChains.find((c) => c.id === chainId);
  const base = chain?.blockExplorers?.default.url;
  if (!base) return hash;
  return `${base}/tx/${hash}`;
}

export function explorerAddressUrl(chainId: number, address: string): string {
  const chain = supportedChains.find((c) => c.id === chainId);
  const base = chain?.blockExplorers?.default.url;
  if (!base) return address;
  return `${base}/address/${address}`;
}

export const rpcUrls: Record<ChainKey, string> = {
  sepolia:
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com",
  "base-sepolia":
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  "rootstock-testnet":
    process.env.NEXT_PUBLIC_ROOTSTOCK_TESTNET_RPC_URL ||
    "https://public-node.testnet.rsk.co",
};

/** Chains where 0x swap quotes are attempted */
export const swapSupportedKeys: ChainKey[] = ["sepolia", "base-sepolia"];

export { sepolia, baseSepolia };
