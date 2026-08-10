import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { newChallenge, signChallenge } from "@/lib/verification";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const handle = typeof body?.handle === "string" ? body.handle : "";
  const wallet = typeof body?.wallet === "string" ? body.wallet : "";
  if (!handle || !isAddress(wallet)) return NextResponse.json({ error: "invalid_challenge_request" }, { status: 400 });
  const payload = newChallenge(handle, wallet);
  return NextResponse.json({ ...payload, token: signChallenge(payload) });
}
