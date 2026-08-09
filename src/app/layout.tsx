import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MintMuse — AI Creator Coins on X Layer",
  description:
    "Mint an AI-generated creator coin from your X profile. Powered by GenLayer AI + X Layer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="aurora" />
        <div className="grid-overlay" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
