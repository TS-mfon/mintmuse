import { NextRequest, NextResponse } from "next/server";
import { readChallenge, signAttestation } from "@/lib/verification";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  try {
    const payload = readChallenge(String(body?.token || ""));
    const res = await fetch(`https://api.fxtwitter.com/${payload.handle}`, {
      headers: { "User-Agent": "MintMuse/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: "profile_refresh_failed" }, { status: 503 });
    const data = await res.json();
    const bio = String(data?.user?.description || "");
    const exactCode = new RegExp(`(^|\\s)${payload.code}(?=\\s|$)`, "i").test(bio);
    if (!exactCode) return NextResponse.json({ error: "verification_code_not_found", bio }, { status: 422 });
    const signature = await signAttestation(payload);
    return NextResponse.json({ signature, handle: payload.handle, expiresAt: payload.expiresAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "verification_failed" }, { status: 400 });
  }
}
