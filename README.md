# JARVIS

Voice-first Web3 assistant. Speak a chain action — JARVIS prepares it; you confirm in your wallet.

Fresh rewrite of the Blockchain J.A.R.V.I.S idea: reliable tool-calling, confirm-gated signing, multi-chain reads/writes, and a brand-first assistant UI.

## Features

- **Voice + text** — hold-to-talk (Gemini audio STT) or type; spoken replies (browser TTS)
- **Agent tools** — balances, token balances, recent transfers, transfers, ERC-20 transfers, 0x swaps, SimpleVault deploy
- **Confirm-gated writes** — unsigned intents only; wallet signs after preview (gas estimate + session soft cap)
- **Chains** — Ethereum Sepolia, Base Sepolia, Rootstock Testnet
- **Activity feed** — session history with explorer links

## Stack

| Layer | Tech |
|-------|------|
| App | Next.js 15, TypeScript, Tailwind, Framer Motion |
| Wallet | wagmi v2, viem (injected browser wallets) |
| Agent | Vercel AI SDK + Google Gemini (AI Studio) |
| Voice | Gemini audio transcription + browser speechSynthesis |
| Contracts | Foundry (`SimpleVault`) |
| Monorepo | pnpm workspaces |

## Setup

```bash
pnpm install
cp .env.example apps/web/.env.local
```

Fill in:

- `GOOGLE_GENERATIVE_AI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey)
- Optional: RPC URLs, `ZEROX_API_KEY`, `NEXT_PUBLIC_SESSION_SPEND_CAP`

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Voice / text examples

- "Check my balance on Base"
- "What can you do on Rootstock?"
- "Show my recent transfers on Sepolia"
- "Send 0.01 ETH to 0x…"
- "Prepare a SimpleVault deploy on Sepolia"
- "Quote a swap of 0.01 ETH to USDC on Base" (needs `ZEROX_API_KEY`)

## Safety

JARVIS **never** holds private keys. Prepare tools return unsigned intents; the UI shows a confirmation card; you sign in-wallet.

Session soft cap (`NEXT_PUBLIC_SESSION_SPEND_CAP`) warns when a native amount exceeds the hint — it does not block signing.

## Layout

```
apps/web            Next.js UI + /api/chat|/transcribe|/speak
packages/agent      Tool schemas, prompts, SimpleVault artifact helpers
packages/chains     Chain configs, explorers, capabilities
contracts           Foundry SimpleVault + deploy script
```

## Contracts

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit   # if needed for scripts
forge build
```

## License

MIT
