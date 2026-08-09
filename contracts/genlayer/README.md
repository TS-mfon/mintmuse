# CreatorMuse — GenLayer AI Contract (StudioNet only)

This is the **AI brain** of MintMuse. It lives **only on GenLayer StudioNet** (chain id 61999,
RPC `https://studio.genlayer.com/api`). The creator coins themselves live on X Layer — see
`../xlayer`.

## What it does
`generate(handle, display_name, bio, followers, recent_text)` calls GenLayer's native LLM
execution (leader/validator consensus) and returns a structured coin concept:

```json
{
  "token_name": "...",
  "ticker": "...",
  "narrative": "...",
  "tokenomics": { "total_supply": 1e9, "creator_allocation_pct": 5, ... },
  "art_prompt": "..."
}
```

## Deploy (via genlayer-dev skill)
```bash
# 1. install the GenLayer dev skill (Claude/marketplace) or the genlayer CLI
# 2. fund your StudioNet wallet from the built-in faucet
# 3. from this folder:
genlayer deploy CreatorMuse.py --network studionet
# copy the printed contract address into NEXT_PUBLIC_... no — into GENLAYER_CONTRACT_ADDRESS
# and set GENLAYER_ENABLED=true in your Vercel env.
```

The frontend calls this contract through `src/lib/genlayer.ts`. Until it is deployed and
`GENLAYER_ENABLED=true`, the app transparently falls back to a free Pollinations-based
generator so it stays fully functional.
