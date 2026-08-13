# CreatorMuse — GenLayer AI Contract (StudioNet only)

This is the **AI brain** of MintMuse. It lives **only on GenLayer StudioNet** (chain id 61999,
RPC `https://studio.genlayer.com/api`). The creator coins themselves live on X Layer — see
`../xlayer`.

## What it does
`generate(request_id, handle, display_name, bio, followers, recent_text)` calls GenLayer's native LLM
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
# copy the printed contract address into GENLAYER_CONTRACT_ADDRESS and
# NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS, then set GENLAYER_ENABLED=true.
```

The server calls this contract through `src/lib/genlayer.ts` with the platform wallet.
Generation is fail-closed: if the contract is unavailable or consensus fails, no fallback
concept is fabricated and no automatic duplicate transaction is submitted.
