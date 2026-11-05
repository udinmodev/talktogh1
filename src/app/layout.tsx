import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import RootChatShell from "@/components/chat/RootChatShell";

export const metadata: Metadata = {
  title: "TalkTogether | Modern End-to-End Encrypted Messenger",
  description: "Private messaging application with zero-knowledge end-to-end encryption, disappearing messages, and privacy security controls.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full w-full overflow-hidden bg-white text-[#050505] font-sans selection:bg-[#0084ff]/20 selection:text-[#0084ff]">
        <Suspense fallback={null}>
          <RootChatShell>{children}</RootChatShell>
        </Suspense>
      </body>
    </html>
  );
}
