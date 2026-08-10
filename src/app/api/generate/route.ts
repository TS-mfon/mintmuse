import { NextRequest, NextResponse } from "next/server";
import { XProfile } from "@/lib/types";
import { generateConcept } from "@/lib/genlayer";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const profile: XProfile = {
    handle: body.handle,
    displayName: body.displayName,
    bio: body.bio,
    followers: body.followers,
    following: body.following,
    recentText: body.recentText,
  };
  if (!profile.handle) {
    return NextResponse.json({ error: "missing handle" }, { status: 400 });
  }
  try {
    const result = await generateConcept(profile);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "generation_failed" }, { status: 502 });
  }
}
