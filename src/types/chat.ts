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
}


export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "error";

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
  isEdited?: boolean; // Message edit indicator
  editedAt?: number | null; // Timestamp when message was edited
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
  appLockPinHash: string;
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
  disappearingTimer: 0, // 0 = Off by default
  safetyNumberVerified: true,
  appLockEnabled: false,
  appLockPinHash: "",
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
