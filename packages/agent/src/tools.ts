import { z } from "zod";
import { tool } from "ai";
import {
  createPublicClient,
  encodeDeployData,
  encodeFunctionData,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import {
  chainByKey,
  describeChainCapabilities,
  resolveChainKey,
  rpcUrls,
  swapSupportedKeys,
  type ChainKey,
} from "@jarvis/chains";
import { chainKeySchema, type UnsignedIntent } from "./types";
import { SIMPLE_VAULT_ABI, SIMPLE_VAULT_BYTECODE } from "./contracts";

function clientFor(chainKey: ChainKey) {
  const chain = chainByKey[chainKey];
  return createPublicClient({
    chain,
    transport: http(rpcUrls[chainKey]),
  });
}

function parseChain(raw: string): ChainKey {
  const key = resolveChainKey(raw) ?? chainKeySchema.parse(raw);
  return key;
}

function newIntentId() {
  return `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export function createJarvisTools(ctx: {
  walletAddress?: Address;
  onIntent?: (intent: UnsignedIntent) => void;
}) {
  return {
    get_chain_capabilities: tool({
      description:
        "Describe what JARVIS can do on a chain (reads, transfers, swaps, deploy).",
      parameters: z.object({
        chain: z.string().describe("sepolia | base-sepolia | rootstock-testnet"),
      }),
      execute: async ({ chain }) => {
        const chainKey = parseChain(chain);
        return {
          ok: true,
          chainKey,
          chainId: chainByKey[chainKey].id,
          ...describeChainCapabilities(chainKey),
        };
      },
    }),

    get_balance: tool({
      description: "Get native token balance for an address on a supported chain.",
      parameters: z.object({
        chain: z.string().describe("sepolia | base-sepolia | rootstock-testnet"),
        address: z
          .string()
          .optional()
          .describe("Wallet address; defaults to connected wallet"),
      }),
      execute: async ({ chain, address }) => {
        const chainKey = parseChain(chain);
        const addr = (address || ctx.walletAddress) as Address | undefined;
        if (!addr || !isAddress(addr)) {
          return { ok: false, error: "No valid wallet address provided." };
        }
        const publicClient = clientFor(chainKey);
        const wei = await publicClient.getBalance({ address: addr });
        const symbol = chainByKey[chainKey].nativeCurrency.symbol;
        return {
          ok: true,
          chainKey,
          chainId: chainByKey[chainKey].id,
          address: addr,
          balance: formatEther(wei),
          symbol,
        };
      },
    }),

    get_token_balances: tool({
      description: "Get ERC-20 token balances for a list of token contracts.",
      parameters: z.object({
        chain: z.string(),
        address: z.string().optional(),
        tokens: z.array(z.string()).min(1).max(10),
      }),
      execute: async ({ chain, address, tokens }) => {
        const chainKey = parseChain(chain);
        const addr = (address || ctx.walletAddress) as Address | undefined;
        if (!addr || !isAddress(addr)) {
          return { ok: false, error: "No valid wallet address provided." };
        }
        const publicClient = clientFor(chainKey);
        const results = [];
        for (const token of tokens) {
          if (!isAddress(token)) {
            results.push({ token, error: "invalid address" });
            continue;
          }
          try {
            const [raw, decimals, symbol] = await Promise.all([
              publicClient.readContract({
                address: token as Address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [addr],
              }),
              publicClient.readContract({
                address: token as Address,
                abi: erc20Abi,
                functionName: "decimals",
              }),
              publicClient.readContract({
                address: token as Address,
                abi: erc20Abi,
                functionName: "symbol",
              }),
            ]);
            results.push({
              token,
              symbol,
              decimals,
              balance: formatUnits(raw, decimals),
            });
          } catch (e) {
            results.push({
              token,
              error: e instanceof Error ? e.message : "read failed",
            });
          }
        }
        return { ok: true, chainKey, address: addr, results };
      },
    }),

    get_tx_history: tool({
      description:
        "Get recent native transfer activity involving an address (last N blocks scan + explorer hint).",
      parameters: z.object({
        chain: z.string(),
        address: z.string().optional(),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      execute: async ({ chain, address, limit }) => {
        const chainKey = parseChain(chain);
        const addr = (address || ctx.walletAddress) as Address | undefined;
        if (!addr || !isAddress(addr)) {
          return { ok: false, error: "No valid wallet address provided." };
        }
        const publicClient = clientFor(chainKey);
        const latest = await publicClient.getBlockNumber();
        const scan = chainKey === "rootstock-testnet" ? 30n : 12n;
        const fromBlock = latest > scan ? latest - scan : 0n;
        const items: Array<{
          hash: string;
          from: string;
          to: string | null;
          value: string;
          blockNumber: string;
        }> = [];

        for (let b = latest; b > fromBlock && items.length < limit; b--) {
          const block = await publicClient.getBlock({
            blockNumber: b,
            includeTransactions: true,
          });
          for (const tx of block.transactions) {
            if (typeof tx === "string") continue;
            const involved =
              tx.from?.toLowerCase() === addr.toLowerCase() ||
              tx.to?.toLowerCase() === addr.toLowerCase();
            if (!involved) continue;
            items.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: formatEther(tx.value),
              blockNumber: b.toString(),
            });
            if (items.length >= limit) break;
          }
        }

        return {
          ok: true,
          chainKey,
          address: addr,
          scannedBlocks: Number(scan),
          items,
          note: "Recent native txs from a short block scan. For full history use the block explorer.",
        };
      },
    }),

    prepare_transfer: tool({
      description:
        "Prepare an unsigned native transfer intent for the user to confirm in their wallet.",
      parameters: z.object({
        chain: z.string(),
        to: z.string(),
        amount: z.string().describe("Human amount in native units, e.g. 0.01"),
      }),
      execute: async ({ chain, to, amount }) => {
        const chainKey = parseChain(chain);
        if (!isAddress(to)) return { ok: false, error: "Invalid recipient." };
        let valueWei: bigint;
        try {
          valueWei = parseEther(amount);
        } catch {
          return { ok: false, error: "Invalid amount." };
        }
        const intent: UnsignedIntent = {
          id: newIntentId(),
          kind: "transfer",
          chainKey,
          chainId: chainByKey[chainKey].id,
          summary: `Send ${amount} ${chainByKey[chainKey].nativeCurrency.symbol} to ${to} on ${chainByKey[chainKey].name}`,
          to: to as Address,
          valueWei: valueWei.toString(),
          nativeAmount: amount,
        };
        ctx.onIntent?.(intent);
        return { ok: true, intent };
      },
    }),

    prepare_token_transfer: tool({
      description: "Prepare an unsigned ERC-20 transfer intent.",
      parameters: z.object({
        chain: z.string(),
        token: z.string(),
        to: z.string(),
        amount: z.string(),
        decimals: z.number().int().min(0).max(36).optional(),
      }),
      execute: async ({ chain, token, to, amount, decimals: decIn }) => {
        const chainKey = parseChain(chain);
        if (!isAddress(token) || !isAddress(to)) {
          return { ok: false, error: "Invalid token or recipient." };
        }
        const publicClient = clientFor(chainKey);
        const decimals =
          decIn ??
          (await publicClient.readContract({
            address: token as Address,
            abi: erc20Abi,
            functionName: "decimals",
          }));
        const symbol = await publicClient.readContract({
          address: token as Address,
          abi: erc20Abi,
          functionName: "symbol",
        });
        const raw = parseUnits(amount, decimals);
        const data = encodeTransferData(to as Address, raw);
        const intent: UnsignedIntent = {
          id: newIntentId(),
          kind: "token_transfer",
          chainKey,
          chainId: chainByKey[chainKey].id,
          summary: `Send ${amount} ${symbol} to ${to} on ${chainByKey[chainKey].name}`,
          to: token as Address,
          valueWei: "0",
          data,
          tokenAddress: token as Address,
          tokenAmount: amount,
          tokenDecimals: decimals,
          nativeAmount: "0",
        };
        ctx.onIntent?.(intent);
        return { ok: true, intent };
      },
    }),

    prepare_swap: tool({
      description:
        "Prepare a swap quote intent via 0x (Ethereum/Base Sepolia only). Returns unsigned tx fields when available.",
      parameters: z.object({
        chain: z.string(),
        sellToken: z.string().describe("Token address or ETH"),
        buyToken: z.string().describe("Token address or symbol address"),
        sellAmount: z.string().describe("Human amount of sell token"),
        sellDecimals: z.number().int().default(18),
      }),
      execute: async ({
        chain,
        sellToken,
        buyToken,
        sellAmount,
        sellDecimals,
      }) => {
        const chainKey = parseChain(chain);
        if (!swapSupportedKeys.includes(chainKey)) {
          return {
            ok: false,
            error:
              "Swap quotes are not supported on Rootstock in v1. Use Sepolia or Base Sepolia.",
          };
        }
        const sellAmountWei = parseUnits(sellAmount, sellDecimals).toString();
        const chainId = chainByKey[chainKey].id;
        const taker = ctx.walletAddress;
        const params = new URLSearchParams({
          chainId: String(chainId),
          sellToken,
          buyToken,
          sellAmount: sellAmountWei,
        });
        if (taker) params.set("taker", taker);

        const headers: Record<string, string> = {
          Accept: "application/json",
        };
        if (process.env.ZEROX_API_KEY) {
          headers["0x-api-key"] = process.env.ZEROX_API_KEY;
          headers["0x-version"] = "v2";
        }

        const url = `https://api.0x.org/swap/allowance-holder/quote?${params}`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const body = await res.text();
          return {
            ok: false,
            error: `0x quote failed (${res.status}). ${body.slice(0, 300)}`,
            hint: "Set ZEROX_API_KEY or verify token addresses for the testnet.",
          };
        }
        const quote = (await res.json()) as {
          transaction?: { to: string; data: string; value: string };
          buyAmount?: string;
        };
        const tx = quote.transaction;
        if (!tx?.to || !tx.data) {
          return { ok: false, error: "Quote missing transaction payload.", quote };
        }
        const intent: UnsignedIntent = {
          id: newIntentId(),
          kind: "swap",
          chainKey,
          chainId,
          summary: `Swap ${sellAmount} (${sellToken}) → ${buyToken} on ${chainByKey[chainKey].name}`,
          to: tx.to as Address,
          data: tx.data as Hex,
          valueWei: tx.value || "0",
          sellToken,
          buyToken,
          nativeAmount: sellToken.toLowerCase() === "eth" ? sellAmount : "0",
          quote: quote as unknown as Record<string, unknown>,
        };
        ctx.onIntent?.(intent);
        return { ok: true, intent };
      },
    }),

    prepare_deploy: tool({
      description:
        "Prepare an unsigned SimpleVault contract deployment for the connected wallet.",
      parameters: z.object({
        chain: z.string(),
        owner: z
          .string()
          .optional()
          .describe("Vault owner; defaults to connected wallet"),
      }),
      execute: async ({ chain, owner }) => {
        const chainKey = parseChain(chain);
        const ownerAddr = (owner || ctx.walletAddress) as Address | undefined;
        if (!ownerAddr || !isAddress(ownerAddr)) {
          return { ok: false, error: "Owner address required." };
        }
        const intent: UnsignedIntent = {
          id: newIntentId(),
          kind: "deploy",
          chainKey,
          chainId: chainByKey[chainKey].id,
          summary: `Deploy SimpleVault (owner ${ownerAddr}) on ${chainByKey[chainKey].name}`,
          bytecode: SIMPLE_VAULT_BYTECODE,
          abi: SIMPLE_VAULT_ABI as unknown[],
          constructorArgs: [ownerAddr],
          data: encodeDeployData({
            abi: SIMPLE_VAULT_ABI,
            bytecode: SIMPLE_VAULT_BYTECODE,
            args: [ownerAddr],
          }),
          nativeAmount: "0",
        };
        ctx.onIntent?.(intent);
        return { ok: true, intent };
      },
    }),
  };
}

function encodeTransferData(to: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });
}
