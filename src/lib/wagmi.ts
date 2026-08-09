import { defineChain } from "viem";
import { metaMask, coinbaseWallet, injected } from "wagmi/connectors";
import { createConfig, http } from "wagmi";

export const xlayer = defineChain({
  id: 195,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_XLAYER_RPC || "https://rpc.xlayer.tech"],
    },
  },
  blockExplorers: {
    default: {
      name: "X Layer Explorer",
      url: process.env.NEXT_PUBLIC_XLAYER_EXPLORER || "https://explorer.xlayer.tech",
    },
  },
  testnet: false,
});

export const wagmiConfig = createConfig({
  chains: [xlayer],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: "MintMuse" }),
    injected({ target: "okxWallet" }),
  ],
  transports: {
    [xlayer.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
