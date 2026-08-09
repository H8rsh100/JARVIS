"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import {
  baseSepolia,
  rootstockTestnet,
  rpcUrls,
  sepolia,
} from "@jarvis/chains";

const rawProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "";

/** WalletConnect Cloud IDs are 32-char hex; placeholders hang RainbowKit forever. */
export const hasValidWalletConnectId = /^[a-f0-9]{32}$/i.test(rawProjectId);

const projectId = hasValidWalletConnectId
  ? rawProjectId
  : "00000000000000000000000000000000";

const wallets = hasValidWalletConnectId
  ? [
      {
        groupName: "Suggested",
        wallets: [injectedWallet, metaMaskWallet, rabbyWallet, walletConnectWallet],
      },
    ]
  : [
      {
        groupName: "Browser",
        wallets: [injectedWallet, metaMaskWallet, rabbyWallet],
      },
    ];

const connectors = connectorsForWallets(wallets, {
  appName: "JARVIS",
  projectId,
});

export const wagmiConfig = createConfig({
  connectors,
  chains: [sepolia, baseSepolia, rootstockTestnet],
  transports: {
    [sepolia.id]: http(rpcUrls.sepolia),
    [baseSepolia.id]: http(rpcUrls["base-sepolia"]),
    [rootstockTestnet.id]: http(rpcUrls["rootstock-testnet"]),
  },
  ssr: true,
});
