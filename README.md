# JARVIS

Voice-first Web3 assistant. Speak blockchain actions — balances, transfers, swaps, deploys — with confirm-gated wallet signing.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind
- **wagmi / viem / RainbowKit** — multi-chain wallets
- **Vercel AI SDK + OpenAI** — agent, Whisper STT, TTS
- **Foundry** — sample contracts
- **pnpm** monorepo

## Chains (v1)

- Ethereum Sepolia
- Base Sepolia
- Rootstock Testnet

## Setup

```bash
pnpm install
cp .env.example apps/web/.env.local
# fill OPENAI_API_KEY + NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Voice examples

- "Check my balance on Base"
- "Send 0.01 ETH to 0x…"
- "Show my recent transfers on Sepolia"
- "Quote a swap of 0.01 ETH to USDC on Base"
- "Prepare a SimpleVault deploy"

**Safety:** JARVIS never holds private keys. Write actions return unsigned intents; you confirm in-wallet.

## Repo layout

```
apps/web          Next.js UI + API routes
packages/agent    Tool schemas + prompts
packages/chains   Chain configs + explorers
contracts         Foundry sample (SimpleVault)
```
