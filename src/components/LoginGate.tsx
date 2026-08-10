"use client";

import { useAccount } from "wagmi";
import { WalletButton } from "./WalletButton";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  if (isConnected) return <>{children}</>;
  return <main className="mint-shell"><div className="noise" aria-hidden="true" /><header className="topbar"><div className="brand"><span className="brand-mark">M</span><span>MintMuse</span></div><WalletButton /></header><section className="gate"><p className="eyebrow">Creator coin protocol · X Layer</p><h1>Shape the signal.<br /><span>Settle the story.</span></h1><p className="lede">Connect a wallet to analyze a public X profile, verify the creator identity, and mint a GenLayer-shaped coin on X Layer testnet.</p><WalletButton /></section></main>;
}
