"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showOptions, setShowOptions] = useState(false);
  if (isConnected && address) return <button className="btn-ghost" onClick={() => disconnect()}>{address.slice(0, 6)}…{address.slice(-4)}</button>;
  const availableConnectors = connectors.filter((connector, index, all) => all.findIndex((item) => item.uid === connector.uid) === index);
  return (
    <div className="wallet-control">
      <button className="btn-primary" disabled={isPending} onClick={() => setShowOptions((visible) => !visible)}>
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {showOptions && !isPending && (
        <div className="wallet-options" role="menu" aria-label="Wallet options">
          {availableConnectors.map((connector) => (
            <button
              key={connector.uid}
              className="wallet-option"
              role="menuitem"
              onClick={() => {
                setShowOptions(false);
                connect({ connector });
              }}
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
