import { NextRequest, NextResponse } from "next/server";
import { XProfile } from "@/lib/types";
import { generateConcept } from "@/lib/genlayer";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

export const maxDuration = 300;

const inFlight = new Map<string, ReturnType<typeof generateConcept>>();
const completed = new Map<string, Awaited<ReturnType<typeof generateConcept>>>();

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
  const clientRequestId = req.headers.get("x-request-id")?.trim() || randomUUID();
  const requestId = createHash("sha256").update(JSON.stringify(profile)).digest("hex");
  if (completed.has(requestId)) return NextResponse.json(completed.get(requestId));
  if (inFlight.has(requestId)) {
    return NextResponse.json({ error: "generation_in_progress", requestId }, { status: 409 });
  }
  try {
    const request = generateConcept(profile);
    inFlight.set(requestId, request);
    const result = await request;
    completed.set(requestId, result);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "generation_failed", requestId: clientRequestId }, { status: 502 });
  } finally {
    inFlight.delete(requestId);
  }
}
