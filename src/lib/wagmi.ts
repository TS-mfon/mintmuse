import { defineChain } from "viem";
import { metaMask, coinbaseWallet, injected } from "wagmi/connectors";
import { createConfig, http } from "wagmi";

export const xlayer = defineChain({
  id: Number(process.env.NEXT_PUBLIC_XLAYER_CHAIN_ID || 1952),
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_XLAYER_RPC || "https://testrpc.xlayer.tech"],
    },
  },
  blockExplorers: {
    default: {
      name: "X Layer Explorer",
      url: process.env.NEXT_PUBLIC_XLAYER_EXPLORER || "https://www.okx.com/web3/explorer/xlayer-test",
    },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [xlayer],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: "MintMuse" }),
    injected({ target: "okxWallet" }),
  ],
  transports: {
    [xlayer.id]: http(process.env.NEXT_PUBLIC_XLAYER_RPC || "https://testrpc.xlayer.tech"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
