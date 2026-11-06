"use client";

import { EncryptedPayload } from "@/lib/crypto";
import { secureSocket, SocketAction } from "./socket";

export type BroadcastAction =
  | {
      type: "NEW_MESSAGE";
      payload: EncryptedPayload;
      messageId: string;
      viewOnce?: boolean;
      disappearingDuration?: number | null;
      securityType?: "standard" | "disappearing" | "view_once" | "confidential";
    }
  | { type: "MESSAGE_STATUS_UPDATE"; messageId: string; status: "delivered" | "read" }
  | { type: "TYPING_INDICATOR"; senderId: string; isTyping: boolean }
  | { type: "KEY_ROTATION"; newVersion: number; senderId: string }
  | { type: "VIEW_ONCE_OPENED"; messageId: string }
  | { type: "TOGGLE_PIN"; messageId: string; isPinned: boolean }
  | { type: "DELETE_MESSAGE"; messageId: string }
  | { type: "EDIT_MESSAGE"; messageId: string; payload: EncryptedPayload; newText: string }
  | { type: "REACTION"; messageId: string; emoji: string; userId: string }
  | { type: "WIPE_ALL"; senderId: string }
  | { type: "USER_PRESENCE"; userId: string; status: "online" | "offline" }
  | { type: "FETCH_MESSAGES"; userId: string }
  | { type: "SYNC_MESSAGES"; messages: any[]; userId?: string }
  | { type: "SAVE_SETTINGS"; userId: string; settings: any }
  | { type: "SYNC_SETTINGS"; settings: any; userId?: string }
  | { type: "SETTINGS_UPDATED"; userId: string; settings: any };

type Listener = (action: BroadcastAction) => void;

class ChatSyncChannel {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<Listener> = new Set();
  private processedActions: Set<string> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      // 1. Local Same-Origin Multi-Tab Channel
      if ("BroadcastChannel" in window) {
        this.channel = new BroadcastChannel("wechat_secure_channel_v1");
        this.channel.onmessage = (event) => {
          this.handleIncoming(event.data);
        };
      }

      // 2. Real-Time WebSocket Network Relay
      secureSocket.subscribe((action) => {
        this.handleIncoming(action as BroadcastAction);
      });
    }
  }

  private handleIncoming(action: BroadcastAction) {
    // Typing indicators toggle frequently and must never be blocked by static deduplication
    if (action.type === "TYPING_INDICATOR") {
      this.listeners.forEach((listener) => listener(action));
      return;
    }

    // Generate a unique fingerprint for deduplication across dual transport
    const actionKey =
      "messageId" in action
        ? `${action.type}:${action.messageId}:${"status" in action ? action.status : ""}:${
            "newText" in action ? action.newText : ""
          }`
        : `${action.type}:${JSON.stringify(action)}`;

    if (this.processedActions.has(actionKey)) return;
    this.processedActions.add(actionKey);

    // Keep deduplication set bounded to last 100 entries
    if (this.processedActions.size > 100) {
      const firstKey = this.processedActions.values().next().value;
      if (firstKey) this.processedActions.delete(firstKey);
    }

    this.listeners.forEach((listener) => listener(action));
  }

  public subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public broadcast(action: BroadcastAction) {
    // 1. Send via WebSocket Relay (for network & cross-browser peers)
    secureSocket.send(action as SocketAction);

    // 2. Send via BroadcastChannel (for instant same-origin tab sync)
    if (this.channel) {
      try {
        this.channel.postMessage(action);
      } catch (err) {
        console.error("Broadcast failed:", err);
      }
    }
  }
}

export const chatSync = new ChatSyncChannel();
