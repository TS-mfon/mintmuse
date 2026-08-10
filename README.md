# MintMuse 🪐 — AI Creator Coins

Turn an X (Twitter) persona into a fair-launch creator coin. MintMuse reads a
creator's **public** X profile, verifies ownership with a temporary X bio code, and a GenLayer AI brain writes the
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
            │  /api/xprofile + /api/verify (public profile + bio proof)
            │  /api/generate  (required GenLayer consensus)
            ▼
   ┌──────────────────┐        ┌──────────────────────────┐
   │ GenLayer         │        │ X Layer (EVM)            │
   │ CreatorMuse.py   │        │ UsernameRegistry.sol     │  handle → wallet
   │ (StudioNet only) │        │ CreatorCoin.sol          │  bonding curve
   │ AI: LLM exec     │        │ CreatorCoinFactory.sol   │  deploy per handle
   └──────────────────┘        └──────────────────────────┘
            │                              ▲
            │ artwork: Pollinations         │ createCoin(handle,name,ticker,artUrl)
            ▼                              │
   Pollinations (free text+image) ────────┘
```

- **AI brain (GenLayer):** `contracts/genlayer/CreatorMuse.py` deployed **only** to
  GenLayer StudioNet (chain 61999, RPC `https://studio.genlayer.com/api`). Uses
  GenLayer's native LLM execution to produce the coin concept JSON.
- **Generation policy:** production generation is fail-closed. If GenLayer is not
  configured or consensus fails, the app preserves the verified profile and asks
  the user to retry; it never silently substitutes template lore.
- **Coins + binding (X Layer):** Solidity contracts deployed to X Layer.

---

## 1. Deploy the X Layer contracts

```bash
cd contracts/xlayer
npm install
export XLAYER_TESTNET_RPC=https://testrpc.xlayer.tech
export DEPLOYER_PK=0xYOUR_PRIVATE_KEY   # funded with OKB for gas
export VERIFIER_ADDRESS=0xPUBLIC_ADDRESS_FOR_VERIFIER_PRIVATE_KEY
npx hardhat run scripts/deploy.js --network xlayerTestnet
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
| `NEXT_PUBLIC_XLAYER_CHAIN_ID` | Vercel | `1952` |
| `NEXT_PUBLIC_XLAYER_EXPLORER` | Vercel | X Layer testnet explorer base URL |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Vercel | deployed `UsernameRegistry` |
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Vercel | deployed `CreatorCoinFactory` |
| `GENLAYER_RPC` | Vercel | StudioNet RPC |
| `GENLAYER_ENABLED` | Vercel | must be `true` for generation |
| `GENLAYER_CONTRACT_ADDRESS` | Vercel | deployed `CreatorMuse` |
| `VERIFICATION_SECRET` | Vercel | HMAC secret for stateless bio challenges |
| `VERIFIER_PRIVATE_KEY` | Vercel | signs short-lived on-chain ownership attestations |
| `POLLINATIONS_IMAGE_MODEL` | Vercel | artwork model after GenLayer concept consensus |

---

## User flow

1. **Connect wallet** (MetaMask / OKX Wallet) — required to enter.
2. **Enter X handle** → app fetches public profile (name, bio, followers, recent posts).
3. **Verify ownership** → add a temporary code to the X bio and receive a signed attestation.
4. **Bind handle** → `UsernameRegistry.register(...)` verifies the attestation on X Layer.
5. **Generate** → GenLayer writes lore + constrained tokenomics; Pollinations renders the art.
6. **Deploy** → `CreatorCoinFactory.createCoin(...)` mints the bonding-curve token.

---

## Tech

- Next.js 14 (App Router) · TypeScript · TailwindCSS · Framer Motion
- wagmi v2 + viem (X Layer EVM) · @tanstack/react-query
- Free X data: Open Graph tags + Jina Reader · Free AI: GenLayer LLM / Pollinations
- Solidity (OpenZeppelin ERC20) bonding curve
- GenLayer Python intelligent contract

No database, no backend server — only GitHub + Vercel.

## Current testnet deployments

- X Layer UsernameRegistry: `0x8864ad5224738db9C8807B2796476a5cfF960Fc8`
- X Layer CreatorCoinFactory: `0xFdA1e070f5D6cb6c26676A138a04634BB943aBef`
- GenLayer StudioNet CreatorMuse: `0x294cd7E68deD3250A17A115f35aE8a8fE72B904F`
