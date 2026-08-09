"use client";

import { LoginGate } from "@/components/LoginGate";
import { MintFlow } from "@/components/MintFlow";
import { WalletButton } from "@/components/WalletButton";

export default function Home() {
  return (
    <main>
      <div className="fixed top-5 right-5 z-50">
        <WalletButton />
      </div>
      <LoginGate>
        <MintFlow />
      </LoginGate>
    </main>
  );
}
