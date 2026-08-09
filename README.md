# MintMuse 🪐 — AI Creator Coins

Turn an X (Twitter) persona into a fair-launch creator coin. MintMuse reads a
creator's **public** X profile (no API key, no X login), an AI brain writes the
coin's lore, tokenomics and artwork, and the coin is deployed as a
**bonding-curve ERC20 on X Layer**. The wallet that mints is bound on-chain to
the X handle.

> Built for the **BuildX AI Season Hackathon** (X Layer / OKX Web3). No database,
> no VPS — frontend on **Vercel**, contracts on **X Layer**, AI brain on **GenLayer StudioNet**.

---

## Architecture

```
┌─────────────────────────┐
│  Next.js (Vercel)       │  UI + serverless API routes (no DB)
│  - Wallet login         │
│  - Animated mint flow   │
└───────────┬─────────────┘
            │  /api/xprofile  (server-side X fetch: OG tags + Jina Reader)
            │  /api/generate  (AI concept)
            ▼
   ┌──────────────────┐        ┌──────────────────────────┐
   │ GenLayer         │        │ X Layer (EVM)            │
   │ CreatorMuse.py   │        │ UsernameRegistry.sol     │  handle → wallet
   │ (StudioNet only) │        │ CreatorCoin.sol          │  bonding curve
   │ AI: LLM exec     │        │ CreatorCoinFactory.sol   │  deploy per handle
   └──────────────────┘        └──────────────────────────┘
            │                              ▲
            │ fallback: Pollinations       │ createCoin(handle,name,ticker,artUrl)
            ▼                              │
   Pollinations (free text+image) ────────┘
```

- **AI brain (GenLayer):** `contracts/genlayer/CreatorMuse.py` deployed **only** to
  GenLayer StudioNet (chain 61999, RPC `https://studio.genlayer.com/api`). Uses
  GenLayer's native LLM execution to produce the coin concept JSON.
- **Fallback (free, no key):** until the GenLayer contract is live
  (`GENLAYER_ENABLED=false`), the app uses Pollinations for both the concept text
  and the artwork, so it stays **fully functional** out of the box.
- **Coins + binding (X Layer):** Solidity contracts deployed to X Layer.

---

## 1. Deploy the X Layer contracts

```bash
cd contracts/xlayer
npm install
export XLAYER_RPC=https://rpc.xlayer.tech
export DEPLOYER_PK=0xYOUR_PRIVATE_KEY   # funded with OKB for gas
npx hardhat run scripts/deploy.js --network xlayer
```

Copy the printed addresses into Vercel env:
`NEXT_PUBLIC_REGISTRY_ADDRESS`, `NEXT_PUBLIC_FACTORY_ADDRESS`.

## 2. Deploy the GenLayer AI contract (StudioNet)

See `contracts/genlayer/README.md`. Fund a StudioNet wallet from the faucet, then:

```bash
genlayer deploy contracts/genlayer/CreatorMuse.py --network studionet
```

Set `GENLAYER_CONTRACT_ADDRESS` and `GENLAYER_ENABLED=true` in Vercel env.

## 3. Deploy the frontend (Vercel)

```bash
# from repo root
vercel  # or push to GitHub and import the repo in Vercel
```

Set the env vars from `.env.example` in the Vercel dashboard. The app builds
with `next build` automatically.

---

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_XLAYER_RPC` | Vercel | X Layer RPC |
| `NEXT_PUBLIC_XLAYER_CHAIN_ID` | Vercel | `195` |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Vercel | deployed `UsernameRegistry` |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Vercel | deployed `CreatorCoinFactory` |
| `GENLAYER_RPC` | Vercel | StudioNet RPC |
| `GENLAYER_ENABLED` | Vercel | `true` once GenLayer contract is live |
| `GENLAYER_CONTRACT_ADDRESS` | Vercel | deployed `CreatorMuse` |
| `POLLINATIONS_TEXT_MODEL` / `POLLINATIONS_IMAGE_MODEL` | Vercel | free fallback models |

---

## User flow

1. **Connect wallet** (MetaMask / OKX Wallet) — required to enter.
2. **Enter X handle** → app fetches public profile (name, bio, followers, recent posts).
3. **Bind handle** → `UsernameRegistry.register(handle)` links handle↔wallet on X Layer.
4. **Generate** → AI writes lore + tokenomics + art prompt, Pollinations renders the art.
5. **Deploy** → `CreatorCoinFactory.createCoin(...)` mints the bonding-curve token.

---

## Tech

- Next.js 14 (App Router) · TypeScript · TailwindCSS · Framer Motion
- wagmi v2 + viem (X Layer EVM) · @tanstack/react-query
- Free X data: Open Graph tags + Jina Reader · Free AI: GenLayer LLM / Pollinations
- Solidity (OpenZeppelin ERC20) bonding curve
- GenLayer Python intelligent contract

No database, no backend server — only GitHub + Vercel.
