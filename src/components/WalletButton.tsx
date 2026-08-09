"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { metaMask } from "wagmi/connectors";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button className="btn-ghost" onClick={() => disconnect()}>
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      className="btn-primary"
      disabled={isPending}
      onClick={() => connect({ connector: metaMask() })}
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
