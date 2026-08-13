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
A creator wants a coin minted from their X persona. Using the data below, invent a
compelling, original creator coin.

Return ONLY a JSON object (no markdown) with exactly these keys:
- "token_name": string, evocative coin name (max 28 chars)
- "ticker": string, 3-5 uppercase letters, unique-feeling
- "narrative": string, 2-3 sentences of lore tying the creator's vibe to the coin
- "tokenomics": object with keys:
    "total_supply" (number, 1e9),
    "creator_allocation_pct" (number 2-10, scaled by follower count: bigger audience => smaller cut),
    "community_allocation_pct" (number, the remainder),
    "initial_price_eth" (number, small, e.g. 0.000001),
    "curve" (string: "bonding")
- "art_prompt": string, a vivid, detailed text-to-image prompt for the coin artwork
  (the creator as a mythic mascot, neon crypto-art, no text in image)

Creator: {display_name} (@{handle})
Followers: {followers}
Bio: {bio}
Recent posts (truncated): {recent_text[:2000]}
"""

        def leader_fn():
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            my_result = leader_fn()
            try:
                a = my_result["ticker"]
                b = my_result["token_name"]
                c = leaders_res.calldata["ticker"]
                d = leaders_res.calldata["token_name"]
                return a == c and b == d
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
