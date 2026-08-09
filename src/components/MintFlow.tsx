"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { REGISTRY_ABI, FACTORY_ABI } from "@/lib/contracts";
import { XProfile, GenerateResult } from "@/lib/types";

const REGISTRY = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined;
const FACTORY = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}` | undefined;
const EXPLORER = process.env.NEXT_PUBLIC_XLAYER_EXPLORER || "https://explorer.xlayer.tech";

type Step = "input" | "preview" | "generating" | "reveal" | "deploying" | "done";

export function MintFlow() {
  const { address } = useAccount();
  const [step, setStep] = useState<Step>("input");
  const [handle, setHandle] = useState("");
  const [profile, setProfile] = useState<XProfile | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [coinAddr, setCoinAddr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read the handle already bound to this wallet (if any).
  const { data: boundHandle } = useReadContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "addressToHandle",
    args: address ? [address] : undefined,
    query: { enabled: !!REGISTRY && !!address },
  });

  const { writeContract: bindHandle, data: bindHash, isPending: binding } = useWriteContract();
  const { writeContract: deployCoin, data: deployHash, isPending: deploying } = useWriteContract();
  const bindReceipt = useWaitForTransactionReceipt({ hash: bindHash });
  const deployReceipt = useWaitForTransactionReceipt({ hash: deployHash });

  const fetchProfile = useCallback(async (h: string) => {
    setError(null);
    const res = await fetch(`/api/xprofile?handle=${encodeURIComponent(h)}`);
    if (!res.ok) throw new Error("Could not fetch X profile (rate-limited? try again).");
    const data = await res.json();
    setProfile(data);
    setStep("preview");
  }, []);

  const onFetch = async () => {
    const h = handle.replace(/^@/, "").trim();
    if (!h) return setError("Enter your X handle.");
    try {
      await fetchProfile(h);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const onBind = () => {
    if (!REGISTRY) return setError("Registry address not set. Deploy contracts first.");
    setError(null);
    bindHandle({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "register", args: [handle] });
  };

  useEffect(() => {
    if (bindReceipt.isSuccess) setError(null);
  }, [bindReceipt.isSuccess]);

  const onGenerate = async () => {
    if (!profile) return;
    setStep("generating");
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Generation failed.");
      const data: GenerateResult = await res.json();
      setResult(data);
      setStep("reveal");
    } catch (e: any) {
      setError(e.message);
      setStep("preview");
    }
  };

  const onDeploy = () => {
    if (!FACTORY || !result) return setError("Factory address not set. Deploy contracts first.");
    setStep("deploying");
    setError(null);
    deployCoin({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: "createCoin",
      args: [handle, result.concept.token_name, result.concept.ticker, result.artUrl],
    });
  };

  useEffect(() => {
    if (deployReceipt.isSuccess && deployHash) {
      setCoinAddr(deployHash); // explorer link uses tx; coin addr is emitted (see README)
      setStep("done");
    }
  }, [deployReceipt.isSuccess, deployHash]);

  const isBound = typeof boundHandle === "string" && (boundHandle as string).length > 0;
  const needsBind = !isBound || (boundHandle as string)?.toLowerCase() !== handle.toLowerCase();

  return (
    <div className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      <Header />

      <AnimatePresence mode="wait">
        {step === "input" && (
          <Panel key="input" title="Start with your X handle">
            <p className="text-purple-200/70 mb-4 text-sm">
              We read your public profile (name, bio, followers, recent posts) — no API key, no login to X.
            </p>
            <div className="flex gap-3">
              <input
                className="input"
                placeholder="@yourhandle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onFetch()}
              />
              <button className="btn-primary whitespace-nowrap" onClick={onFetch}>
                Fetch
              </button>
            </div>
            {isBound && (
              <p className="mt-3 text-xs text-cyan-300">
                Wallet already bound to @{boundHandle}. You can mint for that handle or bind a new one.
              </p>
            )}
            {error && <ErrorLine msg={error} />}
          </Panel>
        )}

        {step === "preview" && profile && (
          <Panel key="preview" title="Confirm your persona">
            <div className="flex items-center gap-4">
              {profile.avatar && (
                <img
                  src={profile.avatar}
                  alt="avatar"
                  className="w-16 h-16 rounded-full border border-neon/40"
                />
              )}
              <div>
                <div className="font-bold text-lg">{profile.displayName || profile.handle}</div>
                <div className="text-purple-300/70 text-sm">@{profile.handle}</div>
                <div className="text-cyan-300/80 text-xs mt-1">
                  {profile.followers ? `${(profile.followers / 1000).toFixed(1)}K followers` : ""}
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-purple-100/80 line-clamp-3">{profile.bio}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-ghost" onClick={() => setStep("input")}>
                ← Change
              </button>
              {needsBind ? (
                <button className="btn-primary" disabled={binding} onClick={onBind}>
                  {binding ? "Binding on-chain…" : `Bind @${profile.handle} to wallet`}
                </button>
              ) : (
                <button className="btn-primary" onClick={onGenerate}>
                  ✨ Generate coin with AI
                </button>
              )}
            </div>
            {error && <ErrorLine msg={error} />}
          </Panel>
        )}

        {step === "generating" && (
          <Panel key="generating" title="The AI is composing your coin">
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="spinner" />
              <p className="text-purple-200/70 text-sm animate-pulse">
                Reading your vibe · writing lore · designing tokenomics · rendering art…
              </p>
            </div>
          </Panel>
        )}

        {step === "reveal" && result && (
          <Panel key="reveal" title={`$${result.concept.ticker} — ${result.concept.token_name}`}>
            <div className="grid md:grid-cols-2 gap-5">
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src={result.artUrl}
                alt="coin art"
                className="w-full rounded-2xl border border-neon/30 shadow-[0_0_40px_rgba(168,85,247,0.35)]"
              />
              <div className="space-y-3">
                <p className="text-sm text-purple-100/85 italic">“{result.concept.narrative}”</p>
                <TokenRow label="Total supply" value={result.concept.tokenomics.total_supply.toLocaleString()} />
                <TokenRow label="Creator allocation" value={`${result.concept.tokenomics.creator_allocation_pct}%`} />
                <TokenRow label="Community" value={`${result.concept.tokenomics.community_allocation_pct}%`} />
                <TokenRow label="Curve" value={result.concept.tokenomics.curve} />
                <p className="text-[11px] text-cyan-300/60 pt-1">
                  AI source: {result.source === "genlayer" ? "GenLayer StudioNet" : "Pollinations (fallback)"}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button className="btn-ghost" onClick={() => setStep("preview")}>
                ← Back
              </button>
              <button className="btn-primary" disabled={deploying} onClick={onDeploy}>
                {deploying ? "Deploying…" : "🚀 Deploy coin on X Layer"}
              </button>
            </div>
            {error && <ErrorLine msg={error} />}
          </Panel>
        )}

        {step === "deploying" && (
          <Panel key="deploying" title="Deploying to X Layer">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="spinner" />
              <p className="text-purple-200/70 text-sm animate-pulse">
                Broadcasting transaction · confirming on X Layer…
              </p>
              {deployHash && (
                <a className="text-xs text-cyan-300 underline" href={`${EXPLORER}/tx/${deployHash}`} target="_blank">
                  view tx
                </a>
              )}
            </div>
          </Panel>
        )}

        {step === "done" && result && (
          <Panel key="done" title="🎉 Your creator coin is live">
            <p className="text-purple-100/85">
              <b>${result.concept.ticker}</b> is deployed on X Layer with a bonding curve. Share it and let
              holders bond with your coin.
            </p>
            <div className="mt-5 flex gap-3">
              <button className="btn-primary" onClick={() => { setStep("input"); setProfile(null); setResult(null); }}>
                Mint another
              </button>
              {deployHash && (
                <a className="btn-ghost" href={`${EXPLORER}/tx/${deployHash}`} target="_blank">
                  View on explorer ↗
                </a>
              )}
            </div>
          </Panel>
        )}
      </AnimatePresence>

      {(!REGISTRY || !FACTORY) && (
        <p className="text-center text-[11px] text-amber-300/70 mt-6">
          Demo mode: set NEXT_PUBLIC_REGISTRY_ADDRESS &amp; NEXT_PUBLIC_FACTORY_ADDRESS (after deploying
          contracts/xlayer) to enable on-chain binding &amp; minting.
        </p>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-extrabold shimmer-text neon">MintMuse</h1>
      <p className="text-purple-200/60 text-sm mt-1">
        AI creator coins · GenLayer brain · X Layer settlement
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35 }}
      className="glass p-7"
    >
      <h2 className="text-xl font-bold mb-4 text-white">{title}</h2>
      {children}
    </motion.div>
  );
}

function TokenRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm border-b border-white/5 pb-1">
      <span className="text-purple-300/60">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return <p className="mt-3 text-xs text-rose-400">{msg}</p>;
}
