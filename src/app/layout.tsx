import type { Metadata, Viewport } from "next";
import { Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";
import RootChatShell from "@/components/chat/RootChatShell";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CipherChat | Modern End-to-End Encrypted Messenger",
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
    <html
      lang="en"
      className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full w-full overflow-hidden bg-white text-[#050505] font-sans selection:bg-[#0084ff]/20 selection:text-[#0084ff]">
        <RootChatShell>{children}</RootChatShell>
      </body>
    </html>
  );
}
