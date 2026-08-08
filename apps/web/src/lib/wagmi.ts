"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import {
  baseSepolia,
  rootstockTestnet,
  rpcUrls,
  sepolia,
} from "@jarvis/chains";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "jarvis_dev_placeholder";

export const wagmiConfig = getDefaultConfig({
  appName: "JARVIS",
  projectId,
  chains: [sepolia, baseSepolia, rootstockTestnet],
  transports: {
    [sepolia.id]: http(rpcUrls.sepolia),
    [baseSepolia.id]: http(rpcUrls["base-sepolia"]),
    [rootstockTestnet.id]: http(rpcUrls["rootstock-testnet"]),
  },
  ssr: true,
});
