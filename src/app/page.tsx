"use client";

import { LoginGate } from "@/components/LoginGate";
import { MintFlow } from "@/components/MintFlow";

export default function Home() { return <LoginGate><MintFlow /></LoginGate>; }
