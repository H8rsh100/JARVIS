"use client";

import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import {
  baseSepolia,
  rootstockTestnet,
  rpcUrls,
  sepolia,
} from "@jarvis/chains";

export const wagmiConfig = createConfig({
  chains: [sepolia, baseSepolia, rootstockTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [sepolia.id]: http(rpcUrls.sepolia),
    [baseSepolia.id]: http(rpcUrls["base-sepolia"]),
    [rootstockTestnet.id]: http(rpcUrls["rootstock-testnet"]),
  },
  ssr: true,
});
