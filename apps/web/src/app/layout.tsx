import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS - Voice Web3 Assistant",
  description:
    "Speak blockchain actions. JARVIS prepares confirm-gated transfers, swaps, and deploys across Sepolia, Base, and Rootstock.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
