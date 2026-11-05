"use client";

import { EncryptedPayload } from "@/lib/crypto";

export type SocketStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

export type SocketAction =
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
  | { type: "WIPE_ALL"; senderId: string }
  | { type: "USER_PRESENCE"; userId: string; status: "online" | "offline" };

type SocketListener = (action: SocketAction) => void;
type StatusListener = (status: SocketStatus) => void;

class SecureWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<SocketListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private status: SocketStatus = "disconnected";
  private currentUserId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isExplicitlyClosed = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.connect();
    }
  }

  public getStatus(): SocketStatus {
    return this.status;
  }

  public registerUser(userId: string) {
    this.currentUserId = userId;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRaw({ type: "REGISTER", userId });
    }
  }

  public connect() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const hostname = window.location.hostname || "localhost";
      const wsUrl = `${protocol}//${hostname}:3001`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("connected");

        // Register user identity if already known
        if (this.currentUserId) {
          this.sendRaw({ type: "REGISTER", userId: this.currentUserId });
        }

        // Start heartbeat ping
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const action = JSON.parse(event.data);
          if (action.type === "PONG" || action.type === "SYSTEM_HANDSHAKE") {
            return;
          }
          this.listeners.forEach((listener) => listener(action));
        } catch (err) {
          console.warn("[WS Client] Error parsing incoming frame:", err);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.setStatus("disconnected");
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // Will trigger onclose and attempt reconnect
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch {
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    // Exponential backoff capped at 8 seconds
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendRaw({ type: "PING" });
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private setStatus(newStatus: SocketStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => listener(newStatus));
    }
  }

  private sendRaw(data: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (err) {
        console.warn("[WS Client] Send error:", err);
      }
    }
  }

  public send(action: SocketAction) {
    this.sendRaw(action as unknown as Record<string, unknown>);
  }

  public subscribe(listener: SocketListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onStatusChange(listener: StatusListener) {
    this.statusListeners.add(listener);
    // Immediately invoke with current state
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }
}

export const secureSocket = new SecureWebSocketClient();
