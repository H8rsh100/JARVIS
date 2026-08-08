import { defineChain } from "viem";

/** Rootstock Testnet (RSK) */
export const rootstockTestnet = defineChain({
  id: 31,
  name: "Rootstock Testnet",
  nativeCurrency: { name: "Test RBTC", symbol: "tRBTC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ROOTSTOCK_TESTNET_RPC_URL ||
          "https://public-node.testnet.rsk.co",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "RSK Explorer",
      url: "https://explorer.testnet.rootstock.io",
    },
  },
  testnet: true,
});
