"use client";

import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { WalletButton } from "./WalletButton";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();

  if (isConnected) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass p-10 max-w-lg w-full"
      >
        <div className="text-6xl mb-4 animate-floaty">🪐</div>
        <h1 className="text-4xl font-extrabold shimmer-text neon">MintMuse</h1>
        <p className="mt-3 text-purple-200/80">
          Turn your X persona into a coin. AI-generated lore, tokenomics &amp; art —
          minted as a bonding-curve token on X Layer.
        </p>
        <p className="mt-6 text-sm text-purple-300/70">
          Connect your wallet to begin. Your X handle is bound on-chain to your address.
        </p>
        <div className="mt-8 flex justify-center">
          <WalletButton />
        </div>
      </motion.div>
    </div>
  );
}
