# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
from dataclasses import dataclass


@allow_storage
@dataclass
class ConceptRequest:
    handle: str
    concept: str


class CreatorMuse(gl.Contract):
    """MintMuse AI brain. Deployed ONLY on GenLayer StudioNet.

    Given a creator's X profile data, it uses GenLayer's native LLM execution
    (leader/validator consensus) to produce a structured coin concept:
    token name, ticker, narrative, tokenomics and an image prompt for the art.
    """

    requests: TreeMap[str, ConceptRequest]
    owner: Address

    def __init__(self, owner: str = ""):
        self.requests = TreeMap[str, ConceptRequest]()
        self.owner = Address(owner) if owner else gl.message.sender_address

    @gl.public.write
    def generate(
        self,
        request_id: str,
        handle: str,
        display_name: str,
        bio: str,
        followers: int,
        recent_text: str,
    ) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the MintMuse platform wallet may generate concepts")
        if request_id in self.requests:
            raise gl.vm.UserError("Duplicate GenLayer request id")
        prompt = f"""You are the AI brain for MintMuse, an on-chain creator-coin launchpad.
Using the creator's public profile below, produce one concise, original coin concept.

Return ONLY a JSON object (no markdown) with exactly these keys:
- "token_name": string, evocative coin name (max 28 chars)
- "ticker": string, 3-5 uppercase letters, unique-feeling
- "narrative": string, exactly 2 concise sentences tying the creator's vibe to the coin
- "tokenomics": object with keys:
    "total_supply" (number, 1e9),
    "creator_allocation_pct" (number 2-10, scaled by follower count: bigger audience => smaller cut),
    "community_allocation_pct" (number, the remainder),
    "initial_price_eth" (number, small, e.g. 0.000001),
    "curve" (string: "bonding")
- "art_prompt": string, one vivid text-to-image prompt for the coin artwork
  (the creator as a mythic mascot, neon crypto-art, no text in image)

Creator: {display_name} (@{handle})
Followers: {followers}
Bio: {bio}
Recent posts (truncated): {recent_text[:800]}
"""

        def leader_fn():
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                concept = leaders_res.calldata
                tokenomics = concept["tokenomics"]
                token_name = concept["token_name"]
                ticker = concept["ticker"]
                narrative = concept["narrative"]
                art_prompt = concept["art_prompt"]
                creator_pct = tokenomics["creator_allocation_pct"]
                community_pct = tokenomics["community_allocation_pct"]
                return (
                    isinstance(token_name, str)
                    and 1 <= len(token_name.strip()) <= 28
                    and isinstance(ticker, str)
                    and 3 <= len(ticker) <= 5
                    and ticker.isalpha()
                    and ticker.isupper()
                    and isinstance(narrative, str)
                    and 20 <= len(narrative) <= 700
                    and isinstance(art_prompt, str)
                    and 20 <= len(art_prompt) <= 700
                    and tokenomics["total_supply"] == 1000000000
                    and isinstance(creator_pct, (int, float))
                    and 2 <= creator_pct <= 10
                    and isinstance(community_pct, (int, float))
                    and creator_pct + community_pct == 100
                    and tokenomics["initial_price_eth"] > 0
                    and tokenomics["curve"] == "bonding"
                )
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.requests[request_id] = ConceptRequest(
            handle=handle,
            concept=json.dumps(result.calldata),
        )

    @gl.public.view
    def get_concept(self, request_id: str) -> str:
        if request_id not in self.requests:
            return ""
        return self.requests[request_id].concept

    @gl.public.view
    def get_handle(self, request_id: str) -> str:
        if request_id not in self.requests:
            return ""
        return self.requests[request_id].handle
