export interface XProfile {
  handle: string;
  displayName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  followers?: number | null;
  following?: number | null;
  recentText?: string;
  fetchedAt?: string;
}

export interface Concept {
  token_name: string;
  ticker: string;
  narrative: string;
  tokenomics: {
    total_supply: number;
    creator_allocation_pct: number;
    community_allocation_pct: number;
    initial_price_eth: number;
    curve: string;
  };
  art_prompt: string;
}

export interface GenerateResult {
  concept: Concept;
  artUrl: string;
  source: "genlayer";
  requestId?: string;
}

export interface VerificationChallenge {
  handle: string;
  wallet: `0x${string}`;
  code: string;
  nonce: `0x${string}`;
  expiresAt: number;
}
