import { EncryptedPayload } from "@/lib/crypto";

export interface User {
  id: string;
  name: string;
  role: "owner" | "contact";
  avatar: string;
  phone: string;
  about: string;
  publicKeyFingerprint: string;
  isOnline: boolean;
  lastSeen?: string;
  isPublicChannel?: boolean;
  channelCategory?: "general" | "e2ee" | "disappearing" | "view_once" | "media" | "documents" | "voice";
  badge?: string;
}

export const SEVEN_PUBLIC_CHATS: User[] = [
  {
    id: "public-general",
    name: "General Community",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80",
    phone: "#general",
    about: "Open public discussion room for all registered identities.",
    publicKeyFingerprint: "PUBLIC-GEN-01",
    isOnline: true,
    lastSeen: "public room",
    isPublicChannel: true,
    channelCategory: "general",
    badge: "Public",
  },
  {
    id: "public-e2ee",
    name: "Confidential E2EE",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
    phone: "#confidential",
    about: "Strictly encrypted room powered by AES-256-GCM zero-knowledge wire cryptography.",
    publicKeyFingerprint: "PUBLIC-E2EE-02",
    isOnline: true,
    lastSeen: "public room",
    isPublicChannel: true,
    channelCategory: "e2ee",
    badge: "AES-256",
  },
  {
    id: "public-disappearing",
    name: "Disappearing Vault",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1501139083538-0139583c060f?w=150&auto=format&fit=crop&q=80",
    phone: "#disappearing",
    about: "Ephemeral messages with automatic countdown timer and self-destruction.",
    publicKeyFingerprint: "PUBLIC-TIME-03",
    isOnline: true,
    lastSeen: "public room",
    isPublicChannel: true,
    channelCategory: "disappearing",
    badge: "Timed",
  },
  {
    id: "public-view-once",
    name: "View-Once Burner",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=150&auto=format&fit=crop&q=80",
    phone: "#view-once",
    about: "Single-read confidential messages that burn permanently immediately upon viewing.",
    publicKeyFingerprint: "PUBLIC-BURN-04",
    isOnline: true,
    lastSeen: "public room",
    isPublicChannel: true,
    channelCategory: "view_once",
    badge: "1-View",
  },
  {
    id: "public-media",
    name: "Photos & Media",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop&q=80",
    phone: "#media",
    about: "Encrypted photo, image and media sharing showroom.",
    publicKeyFingerprint: "PUBLIC-MEDIA-05",
    isOnline: true,
    lastSeen: "public room",
    isPublicChannel: true,
    channelCategory: "media",
    badge: "Media",
  },
  {
    id: "public-docs",
    name: "Documents Vault",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=150&auto=format&fit=crop&q=80",
    phone: "#documents",
    about: "Confidential files, PDFs and research document exchange.",
    publicKeyFingerprint: "PUBLIC-DOCS-06",
    isOnline: true,
    lastSeen: "public room",
    isPublicChannel: true,
    channelCategory: "documents",
    badge: "Files",
  },
  {
    id: "public-voice",
    name: "Voice Memos",
    role: "contact",
    avatar: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=150&auto=format&fit=crop&q=80",
    phone: "#voice",
    about: "Encrypted voice notes and audio waveform recordings.",
    publicKeyFingerprint: "PUBLIC-VOICE-07",
    isOnline: true,
    lastSeen: "public room",
    isPublicChannel: true,
    channelCategory: "voice",
    badge: "Voice",
  },
];

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  text: string; // Plaintext when decrypted in local memory
  encryptedPayload: EncryptedPayload; // Verifiable AES-256-GCM ciphertext + IV
  timestamp: number;
  status: MessageStatus;
  disappearingDuration?: number | null; // In seconds (e.g. 10s, 30s, 60s, 3600s)
  expiresAt?: number | null; // Absolute epoch timestamp when it self-destructs
  reactions?: Record<string, string>; // userId -> emoji
  isSecret?: boolean;
  mediaType?: "image" | "voice" | "doc";
  mediaUrl?: string;
  mediaDuration?: number; // For voice message seconds
  viewOnce?: boolean; // Signal / WhatsApp style View-Once message
  isBurned?: boolean; // When opened, immediately destroyed
  isPinned?: boolean; // Pinned message feature
  securityType?: "standard" | "disappearing" | "view_once" | "confidential";
  linkMetadata?: LinkMetadata[];
}

export type ThemeColor = "blue" | "emerald" | "slate" | "purple" | "rose" | "amber";
export type ChatWallpaper = "default" | "dots" | "grid" | "warm" | "dark";
export type FontSize = "small" | "medium" | "large";
export type BubbleStyle = "modern" | "pill" | "compact";

export interface SecuritySettings {
  // Security & Privacy
  e2eeEnabled: boolean;
  disappearingTimer: number; // 0 = off, 10 = 10s, 30 = 30s, 60 = 1m, 3600 = 1h, 86400 = 24h
  safetyNumberVerified: boolean;
  appLockEnabled: boolean;
  appLockPin: string;
  inactivityLockSeconds: number; // 60, 300, 0 = immediate
  privacyCurtain: boolean; // Auto-blur on tab switch / window blur
  antiScreenshotWatermark: boolean;
  preventCopyForward: boolean;
  keyRotationVersion: number;
  lastRekeyedAt: number;

  // Customization Settings
  themeColor: ThemeColor;
  chatWallpaper: ChatWallpaper;
  fontSize: FontSize;
  bubbleStyle: BubbleStyle;
  soundEffects: boolean;
  enterToSend: boolean;
  readReceipts: boolean;
}

export const DEFAULT_SETTINGS: SecuritySettings = {
  e2eeEnabled: true,
  disappearingTimer: 30,
  safetyNumberVerified: true,
  appLockEnabled: false,
  appLockPin: "1234",
  inactivityLockSeconds: 60,
  privacyCurtain: false,
  antiScreenshotWatermark: false,
  preventCopyForward: false,
  keyRotationVersion: 1,
  lastRekeyedAt: 0,
  themeColor: "emerald",
  chatWallpaper: "default",
  fontSize: "medium",
  bubbleStyle: "modern",
  soundEffects: true,
  enterToSend: true,
  readReceipts: true,
};
