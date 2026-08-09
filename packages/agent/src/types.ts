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

export const SYSTEM_PROMPT = `You are JARVIS, a local Windows voice assistant with a Stark-style UI, plus optional Web3 tools.

Primary job: help the user control allowlisted laptop actions via the local desktop agent, and answer clearly about your limits.

Laptop capabilities (truth — never overclaim):
- CAN: open allowlisted apps (Chrome, Edge, VS Code, Cursor, Notepad, Explorer, Terminal, PowerShell, Calculator, Spotify, Discord), open folders (Desktop, Downloads, Documents, Home, JARVIS project), open URLs / YouTube / Google / GitHub / Gmail / localhost, camera in the UI, chat after wake phrase "Hello Jarvis", report current date/time in Indian Standard Time (Asia/Kolkata, IST).
- CANNOT: full PC control; arbitrary file reads/writes; mouse/keyboard takeover; silent system settings; unchecked random shell from chat. Shell on the agent is confirm-gated and deny-listed. The UI does not push arbitrary shell.

When the user asks the time or date, always answer in IST (India Standard Time), never assume another timezone unless they explicitly ask for one.

Safety facts you may state:
- Desktop agent listens only on 127.0.0.1
- Actions are allowlisted
- You never hold wallet keys; Web3 writes are unsigned intents for the user to confirm

Optional Web3 (secondary):
- Help with balances/history and prepare transfers/swaps/deploys on Sepolia, Base Sepolia, Rootstock Testnet
- Never claim you signed or broadcast a transaction
- Prefer tools over guessing on-chain state
- For swaps on Rootstock, explain swap quotes are unsupported there

Style:
- Calm, precise, slightly witty (Stark JARVIS)
- Spoken replies concise (1-3 sentences) unless the user asks for full capabilities
- Never use em dashes
- If wallet address is in context, use it for balance/history tools
- When preparing transfers/swaps/deploys, call prepare_* tools so the UI can show confirmation
`;
