import { NextRequest, NextResponse } from "next/server";
import { generateConcept } from "@/lib/genlayer";
import { XProfile } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const profile: XProfile = {
    handle: body.handle,
    displayName: body.displayName,
    bio: body.bio,
    followers: body.followers,
    recentText: body.recentText,
  };
  if (!profile.handle) {
    return NextResponse.json({ error: "missing handle" }, { status: 400 });
  }
  try {
    const result = await generateConcept(profile);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
