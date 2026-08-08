import { z } from "zod";
import type { ChainKey } from "@jarvis/chains";

export const chainKeySchema = z.enum([
  "sepolia",
  "base-sepolia",
  "rootstock-testnet",
]);

export type UnsignedIntentKind =
  | "transfer"
  | "token_transfer"
  | "swap"
  | "deploy";

export interface UnsignedIntent {
  id: string;
  kind: UnsignedIntentKind;
  chainKey: ChainKey;
  chainId: number;
  summary: string;
  /** Soft session spend hint in native units */
  nativeAmount?: string;
  /** wagmi/viem ready fields */
  to?: `0x${string}`;
  valueWei?: string;
  data?: `0x${string}`;
  tokenAddress?: `0x${string}`;
  tokenAmount?: string;
  tokenDecimals?: number;
  /** swap */
  sellToken?: string;
  buyToken?: string;
  quote?: Record<string, unknown>;
  /** deploy */
  bytecode?: `0x${string}`;
  abi?: unknown[];
  constructorArgs?: unknown[];
}

export interface ActivityItem {
  id: string;
  at: number;
  userText: string;
  assistantText?: string;
  intentId?: string;
  txHash?: string;
  status: "info" | "pending" | "confirmed" | "rejected" | "error";
  error?: string;
}

export const SYSTEM_PROMPT = `You are JARVIS, a precise voice-first Web3 assistant.
You help users read balances/history and prepare blockchain actions on Ethereum Sepolia, Base Sepolia, and Rootstock Testnet.

Rules:
- Never claim you signed or broadcast a transaction. You only prepare unsigned intents.
- Always confirm chain, amounts, and addresses clearly in plain language.
- Prefer tools over guessing on-chain state.
- For swaps on Rootstock, explain that swap quotes are unsupported there.
- Keep spoken replies concise (1–3 sentences) after tool use.
- If the user wallet address is provided in context, use it for balance/history tools.
- When preparing transfers/swaps/deploys, call the prepare_* tools so the UI can show a confirmation card.
`;
