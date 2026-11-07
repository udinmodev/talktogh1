/**
 * Client and Server Shared Zero-Knowledge Wire Types
 * No Node.js native modules (fs, pg, dns, net) are imported here.
 */

export interface WireMessage {
  id: string;
  senderId: string;
  recipientId: string;
  encryptedPayload: {
    ciphertext: string;
    iv: string;
    algorithm: string;
    senderId: string;
    recipientId: string;
    timestamp: number;
    keyEpoch?: number;
    aadDigest?: string;
    integrityStatus?: "verified" | "tampered";
    hmacSignature?: string;
  };
  timestamp: number;
  status: "sending" | "sent" | "delivered" | "read";
  disappearingDuration?: number | null;
  expiresAt?: number | null;
  viewOnce?: boolean;
  isBurned?: boolean;
  isPinned?: boolean;
  isEdited?: boolean;
  editedAt?: number | null;
  securityType?: "standard" | "disappearing" | "view_once" | "confidential";
  mediaType?: "image" | "voice" | "doc";
  mediaUrl?: string;
  reactions?: Record<string, string>;
}

export interface SupabaseWireRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  encrypted_payload: WireMessage["encryptedPayload"];
  timestamp: number;
  status: string;
  disappearing_duration: number | null;
  expires_at: number | null;
  view_once: boolean;
  is_burned: boolean;
  is_pinned: boolean;
  is_edited?: boolean;
  edited_at?: number | null;
  security_type: string;
  media_type: string | null;
  media_url: string | null;
  reactions: Record<string, string> | null;
  created_at?: string;
}

export function toSupabaseRow(m: WireMessage): SupabaseWireRow {
  return {
    id: m.id,
    sender_id: m.senderId,
    recipient_id: m.recipientId,
    encrypted_payload: m.encryptedPayload,
    timestamp: m.timestamp,
    status: m.status || "delivered",
    disappearing_duration: m.disappearingDuration ?? null,
    expires_at: m.expiresAt ?? null,
    view_once: Boolean(m.viewOnce),
    is_burned: Boolean(m.isBurned),
    is_pinned: Boolean(m.isPinned),
    is_edited: Boolean(m.isEdited),
    edited_at: m.editedAt ?? null,
    security_type: m.securityType || "standard",
    media_type: m.mediaType ?? null,
    media_url: m.mediaUrl ?? null,
    reactions: m.reactions ?? {},
  };
}

export function fromSupabaseRow(row: SupabaseWireRow): WireMessage {
  let ep: any = row.encrypted_payload;
  if (typeof ep === "string") {
    try {
      ep = JSON.parse(ep);
    } catch {}
  }

  let reactions = row.reactions;
  if (typeof reactions === "string") {
    try {
      reactions = JSON.parse(reactions);
    } catch {}
  }

  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    encryptedPayload: ep,
    timestamp: Number(row.timestamp),
    status: row.status as WireMessage["status"],
    disappearingDuration: row.disappearing_duration,
    expiresAt: row.expires_at ? Number(row.expires_at) : null,
    viewOnce: Boolean(row.view_once),
    isBurned: Boolean(row.is_burned),
    isPinned: Boolean(row.is_pinned),
    isEdited: Boolean(row.is_edited),
    editedAt: row.edited_at ? Number(row.edited_at) : null,
    securityType: row.security_type as WireMessage["securityType"],
    mediaType: row.media_type as WireMessage["mediaType"],
    mediaUrl: row.media_url ?? undefined,
    reactions: reactions ?? undefined,
  };
}
