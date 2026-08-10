"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeEventLog, isAddress } from "viem";
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { FACTORY_ABI, REGISTRY_ABI } from "@/lib/contracts";
import { Concept, GenerateResult, XProfile } from "@/lib/types";

const REGISTRY = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined;
const FACTORY = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}` | undefined;
const EXPLORER = process.env.NEXT_PUBLIC_XLAYER_EXPLORER || "https://www.okx.com/web3/explorer/xlayer-test";
const TARGET_CHAIN = Number(process.env.NEXT_PUBLIC_XLAYER_CHAIN_ID || 1952);

type Step = "input" | "verify" | "preview" | "generating" | "reveal" | "deploying" | "done";
const steps: Array<{ id: Step; label: string }> = [
  { id: "input", label: "Profile" },
  { id: "verify", label: "Verify" },
  { id: "preview", label: "Signal" },
  { id: "generating", label: "GenLayer" },
  { id: "reveal", label: "Review" },
  { id: "deploying", label: "Mint" },
];

export function MintFlow() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [step, setStep] = useState<Step>("input");
  const [handle, setHandle] = useState("");
  const [profile, setProfile] = useState<XProfile | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [verificationSignature, setVerificationSignature] = useState<`0x${string}` | null>(null);
  const [verificationExpiry, setVerificationExpiry] = useState<number | null>(null);
  const [verificationNonce, setVerificationNonce] = useState<`0x${string}` | null>(null);
  const [coinAddr, setCoinAddr] = useState<`0x${string}` | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const generatingRef = useRef(false);
  const [followerDisplay, setFollowerDisplay] = useState(0);
  const [followingDisplay, setFollowingDisplay] = useState(0);

  const { data: boundHandle, refetch: refetchBoundHandle } = useReadContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "addressToHandle",
    args: address ? [address] : undefined,
    query: { enabled: !!REGISTRY && !!address },
  });
  const { writeContract: writeBinding, data: bindHash, isPending: bindingPending } = useWriteContract();
  const { writeContract: writeCoin, data: deployHash } = useWriteContract();
  const bindReceipt = useWaitForTransactionReceipt({ hash: bindHash });
  const deployReceipt = useWaitForTransactionReceipt({ hash: deployHash });

  const canonicalHandle = handle.replace(/^@/, "").trim().toLowerCase();
  const networkReady = chainId === TARGET_CHAIN;
  const isBound = typeof boundHandle === "string" && boundHandle.length > 0;
  const readyCount = [Boolean(address), networkReady, Boolean(profile), Boolean(verificationSignature), Boolean(result)].filter(Boolean).length;
  const statusText = step === "generating" ? "GenLayer is reaching consensus…" : step === "deploying" ? "X Layer is confirming the mint…" : notice;

  const animateCount = useCallback((target: number | null | undefined, setter: (value: number) => void) => {
    if (target == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setter(target);
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setter(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animateCount(profile?.followers, setFollowerDisplay);
    animateCount(profile?.following, setFollowingDisplay);
  }, [animateCount, profile?.followers, profile?.following]);

  const fetchProfile = async () => {
    setError(null); setNotice(null);
    if (!canonicalHandle) return setError("Enter an X handle.");
    if (!/^[a-z0-9_]{1,15}$/i.test(canonicalHandle)) return setError("Use 1–15 letters, numbers, or underscores.");
    try {
      const response = await fetch(`/api/xprofile?handle=${encodeURIComponent(canonicalHandle)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "profile_not_found" ? `We couldn't find @${canonicalHandle}.` : data.error || "Profile lookup failed.");
      setHandle(data.handle || canonicalHandle); setProfile(data); setResult(null); setVerificationSignature(null); setStep("verify");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Profile lookup failed."); }
  };

  const startVerification = async () => {
    if (!address || !profile) return setError("Connect a wallet before verifying.");
    setError(null);
    try {
      const response = await fetch("/api/verify/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handle: profile.handle, wallet: address }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create verification code.");
      setChallengeToken(data.token); setChallengeCode(data.code); setVerificationNonce(data.nonce); setVerificationExpiry(data.expiresAt); setVerificationSignature(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create verification code."); }
  };

  const confirmVerification = async () => {
    if (!challengeToken) return;
    setError(null);
    try {
      const response = await fetch("/api/verify/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: challengeToken }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "verification_code_not_found" ? "The code is not visible in the fresh X bio yet." : data.error || "Verification failed.");
      setVerificationSignature(data.signature); setVerificationExpiry(data.expiresAt); setNotice("X bio verified. You can now bind the handle on-chain."); setStep("preview");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed."); }
  };

  const bindHandle = () => {
    if (!REGISTRY || !address || !profile || !verificationSignature || !verificationNonce || !verificationExpiry) return setError("Complete X verification first.");
    if (!networkReady) return setError(`Switch your wallet to X Layer testnet (${TARGET_CHAIN}).`);
    try {
      writeBinding({ address: REGISTRY, abi: REGISTRY_ABI, functionName: "register", args: [profile.handle, BigInt(verificationExpiry), verificationNonce, verificationSignature] });
    } catch (cause) { setBindingError(cause instanceof Error ? cause.message : "Could not prepare binding."); }
  };

  useEffect(() => {
    if (bindReceipt.isSuccess) { refetchBoundHandle(); setNotice("Handle binding confirmed on X Layer."); setError(null); }
    if (bindReceipt.isError) setBindingError("Handle binding reverted or was rejected. Your profile is safe; retry the binding step.");
  }, [bindReceipt.isSuccess, bindReceipt.isError, refetchBoundHandle]);

  const generate = async () => {
    if (!profile || generatingRef.current) return;
    generatingRef.current = true; setError(null); setNotice("Request submitted once. Waiting for GenLayer consensus…"); setStep("generating");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json", "x-request-id": crypto.randomUUID() }, body: JSON.stringify(profile) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "GenLayer generation failed.");
      setResult(data); setNotice("Consensus complete. Review your proposed coin."); setStep("reveal");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Generation failed."); setStep("preview"); }
    finally { generatingRef.current = false; }
  };

  const deploy = () => {
    if (!FACTORY || !result || !profile) return setError("Factory configuration is missing.");
    if (!networkReady) return setError(`Switch your wallet to X Layer testnet (${TARGET_CHAIN}).`);
    setError(null); setStep("deploying");
    writeCoin({ address: FACTORY, abi: FACTORY_ABI, functionName: "createCoin", args: [profile.handle, result.concept.token_name, result.concept.ticker, result.artUrl] });
  };

  useEffect(() => {
    if (!deployReceipt.isSuccess || !deployReceipt.data) return;
    const event = deployReceipt.data.logs.map((log) => {
      try { return decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics }); } catch { return null; }
    }).find((decoded) => decoded?.eventName === "CoinCreated");
    const coin = event?.args && "coin" in event.args ? event.args.coin : null;
    if (coin && isAddress(coin)) { setCoinAddr(coin); setStep("done"); setNotice("Coin deployment confirmed and read back from the receipt."); }
    else { setError("Mint confirmed, but the coin address could not be decoded. Check the transaction before retrying."); setStep("reveal"); }
  }, [deployReceipt.data, deployReceipt.isSuccess]);

  useEffect(() => { if (deployReceipt.isError) { setError("Coin deployment reverted or was rejected. No duplicate transaction was sent."); setStep("reveal"); } }, [deployReceipt.isError]);

  return (
    <main className="mint-shell">
      <div className="noise" aria-hidden="true" /><div className="wave wave-a" aria-hidden="true" /><div className="wave wave-b" aria-hidden="true" />
      <Header networkReady={networkReady} />
      <div className="stepper" aria-label="Mint progress">{steps.map((item, index) => <span key={item.id} className={steps.findIndex((s) => s.id === step) >= index ? "step active" : "step"}>{String(index + 1).padStart(2, "0")} {item.label}</span>)}</div>
      <section className="workspace">
        <div className="control-rail">
          <p className="eyebrow">Creator coin protocol · X Layer</p>
          <h1>Turn your public signal into an on-chain identity.</h1>
          <p className="lede">MintMuse uses a verified public X profile and GenLayer consensus to shape a proposed coin before X Layer settlement.</p>
          <div className="panel main-panel">
            {step === "input" && <InputStage handle={handle} setHandle={setHandle} onFetch={fetchProfile} disabled={!address} />}
            {step === "verify" && profile && <VerifyStage profile={profile} code={challengeCode} onStart={startVerification} onConfirm={confirmVerification} />}
            {step === "preview" && profile && <PreviewStage profile={profile} followerDisplay={followerDisplay} followingDisplay={followingDisplay} bound={isBound && String(boundHandle).toLowerCase() === profile.handle.toLowerCase()} onBind={bindHandle} onGenerate={generate} binding={bindingPending} verified={Boolean(verificationSignature)} />}
            {step === "generating" && <ProgressStage label="GenLayer consensus" detail="Your request is being validated across the AI network. Do not refresh or submit again." />}
            {step === "reveal" && result && <RevealStage result={result} onDeploy={deploy} />}
            {step === "deploying" && <ProgressStage label="X Layer settlement" detail={deployHash ? "Transaction submitted. Waiting for a confirmed receipt." : "Approve the transaction in your wallet."} hash={deployHash} />}
            {step === "done" && result && coinAddr && <DoneStage result={result} coin={coinAddr} tx={deployHash} onReset={() => { setStep("input"); setProfile(null); setResult(null); setCoinAddr(null); setChallengeCode(null); setVerificationSignature(null); }} />}
            {error && <p className="error" role="alert">{error}</p>}{bindingError && <p className="error" role="alert">{bindingError}</p>}{statusText && <p className="status" aria-live="polite">{statusText}</p>}
          </div>
        </div>
        <VisualStage active={step !== "input"} strength={readyCount / 5} />
        <MetricsPanel profile={profile} followerDisplay={followerDisplay} followingDisplay={followingDisplay} readyCount={readyCount} networkReady={networkReady} bound={isBound} />
      </section>
      {verificationExpiry && <p className="footnote">Verification expires {new Date(verificationExpiry * 1000).toLocaleTimeString()} · remove the bio code only after binding confirms.</p>}
    </main>
  );
}

function Header({ networkReady }: { networkReady: boolean }) { return <header className="topbar"><div className="brand"><span className="brand-mark">M</span><span>MintMuse</span></div><div className={networkReady ? "network ok" : "network"}><span /> X Layer testnet · {TARGET_CHAIN}</div></header>; }
function InputStage({ handle, setHandle, onFetch, disabled }: { handle: string; setHandle: (v: string) => void; onFetch: () => void; disabled: boolean }) { return <div><h2>Analyze a creator profile</h2><p className="muted">Start with public X data. Metrics remain factual; only the lore and artwork are AI-generated.</p><label htmlFor="handle">X handle</label><div className="input-row"><input id="handle" className="input" placeholder="@yourhandle" value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onFetch()} /><button className="btn-primary" onClick={onFetch} disabled={disabled}>{disabled ? "Connect wallet" : "Analyze"}</button></div></div>; }
function VerifyStage({ profile, code, onStart, onConfirm }: { profile: XProfile; code: string | null; onStart: () => void; onConfirm: () => void }) { return <div><h2>Verify the X identity</h2><p className="muted">Add this exact code to the public bio, then check it again. This prevents wallets from claiming someone else’s handle.</p><div className="profile-mini"><img src={profile.avatar || ""} alt="" /><div><strong>{profile.displayName || profile.handle}</strong><span>@{profile.handle}</span></div></div>{code ? <div className="code-box"><span>{code}</span><button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(code)}>Copy</button><button className="btn-primary" onClick={onConfirm}>Check bio</button></div> : <button className="btn-primary" onClick={onStart}>Generate verification code</button>}</div>; }
function PreviewStage({ profile, followerDisplay, followingDisplay, bound, verified, onBind, onGenerate, binding }: { profile: XProfile; followerDisplay: number; followingDisplay: number; bound: boolean; verified: boolean; onBind: () => void; onGenerate: () => void; binding: boolean }) { return <div><h2>Signal report</h2><div className="profile-mini"><img src={profile.avatar || ""} alt="" /><div><strong>{profile.displayName || profile.handle}</strong><span>@{profile.handle}</span></div></div><p className="bio">{profile.bio || "Bio unavailable"}</p><div className="metric-grid"><Metric label="Followers" value={profile.followers == null ? "Unavailable" : followerDisplay.toLocaleString()} source="X profile" /><Metric label="Following" value={profile.following == null ? "Unavailable" : followingDisplay.toLocaleString()} source="X profile" /></div><div className="action-stack">{!bound && <button className="btn-primary" disabled={!verified || binding} onClick={onBind}>{binding ? "Binding…" : verified ? "Bind verified handle" : "Verify bio first"}</button>}<button className="btn-ghost" disabled={!bound} onClick={onGenerate}>Generate with GenLayer</button></div></div>; }
function Metric({ label, value, source }: { label: string; value: string; source: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{source}</small></div>; }
function ProgressStage({ label, detail, hash }: { label: string; detail: string; hash?: `0x${string}` }) { return <div className="progress-stage"><div className="spinner" /><h2>{label}</h2><p className="muted">{detail}</p>{hash && <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer" className="link">View transaction ↗</a>}</div>; }
function RevealStage({ result, onDeploy }: { result: GenerateResult; onDeploy: () => void }) { const concept: Concept = result.concept; return <div><div className="art-frame"><img src={result.artUrl} alt={`AI-generated artwork for ${concept.token_name}`} /></div><p className="source-tag">AI generated · GenLayer consensus</p><h2>{concept.token_name} <span>${concept.ticker}</span></h2><p className="bio">{concept.narrative}</p><div className="metric-grid"><Metric label="Supply" value={concept.tokenomics.total_supply.toLocaleString()} source="Proposed preset" /><Metric label="Curve" value="Bonding" source="X Layer contract" /></div><button className="btn-primary full" onClick={onDeploy}>Deploy proposed coin</button></div>; }
function DoneStage({ result, coin, tx, onReset }: { result: GenerateResult; coin: `0x${string}`; tx?: `0x${string}`; onReset: () => void }) { return <div><p className="eyebrow">Confirmed on X Layer</p><h2>${result.concept.ticker} is live.</h2><div className="address-box"><span>Coin contract</span><code>{coin}</code><button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(coin)}>Copy</button></div>{tx && <a className="link" href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noreferrer">View deployment transaction ↗</a>}<button className="btn-primary full" onClick={onReset}>Mint another</button></div>; }
function VisualStage({ active, strength }: { active: boolean; strength: number }) { return <div className="visual-stage" aria-hidden="true"><div className="orbital orbital-one" /><div className="orbital orbital-two" /><div className="core" style={{ opacity: 0.55 + strength * 0.45, transform: `scale(${0.92 + strength * 0.12})` }}><span>{active ? "MM" : "M"}</span></div><div className="visual-caption">{active ? "signal → concept → settlement" : "public signal, privately shaped"}</div></div>; }
function MetricsPanel({ profile, followerDisplay, followingDisplay, readyCount, networkReady, bound }: { profile: XProfile | null; followerDisplay: number; followingDisplay: number; readyCount: number; networkReady: boolean; bound: boolean }) { return <aside className="metrics-panel"><div className="panel-kicker">Live signal</div><div className="hero-stat"><span>Followers</span><strong>{profile?.followers == null ? "—" : followerDisplay.toLocaleString()}</strong><small>source · X profile</small></div><div className="progress-line"><span style={{ width: `${readyCount * 20}%` }} /></div><p className="readiness">Mint readiness <b>{readyCount} / 5</b></p><div className="status-list"><p><i className={networkReady ? "dot good" : "dot bad"} />Network <b>{networkReady ? "Ready" : "Switch required"}</b></p><p><i className={profile ? "dot good" : "dot"} />Profile <b>{profile ? "Loaded" : "Waiting"}</b></p><p><i className={bound ? "dot good" : "dot"} />Binding <b>{bound ? "Confirmed" : "Pending"}</b></p></div><div className="secondary-stat"><span>Following</span><strong>{profile?.following == null ? "Unavailable" : followingDisplay.toLocaleString()}</strong><small>real profile metric</small></div></aside>; }
