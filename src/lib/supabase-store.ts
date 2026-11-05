import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { WireMessage } from "./server-store";

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
    security_type: m.securityType || "standard",
    media_type: m.mediaType ?? null,
    media_url: m.mediaUrl ?? null,
    reactions: m.reactions ?? {},
  };
}

export function fromSupabaseRow(row: SupabaseWireRow): WireMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    encryptedPayload: row.encrypted_payload,
    timestamp: Number(row.timestamp),
    status: row.status as WireMessage["status"],
    disappearingDuration: row.disappearing_duration,
    expiresAt: row.expires_at ? Number(row.expires_at) : null,
    viewOnce: Boolean(row.view_once),
    isBurned: Boolean(row.is_burned),
    isPinned: Boolean(row.is_pinned),
    securityType: row.security_type as WireMessage["securityType"],
    mediaType: row.media_type as WireMessage["mediaType"],
    mediaUrl: row.media_url ?? undefined,
    reactions: row.reactions ?? undefined,
  };
}

/**
 * Fetch all active wire messages from Supabase
 */
export async function fetchSupabaseWireMessages(since: number = 0): Promise<WireMessage[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    let query = client
      .from("wire_messages")
      .select("*")
      .order("timestamp", { ascending: true });

    if (since > 0) {
      query = query.gt("timestamp", since);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase] Query error:", error.message);
      return null;
    }

    if (!data) return [];

    const now = Date.now();
    const rows = (data as SupabaseWireRow[])
      .map(fromSupabaseRow)
      .filter((m) => {
        // Filter out expired self-destructing messages
        if (m.expiresAt && m.expiresAt <= now) {
          return false;
        }
        return true;
      });

    return rows;
  } catch (err) {
    console.error("[Supabase] fetch error:", err);
    return null;
  }
}

/**
 * Save / Upsert batch of wire messages to Supabase
 */
export async function saveSupabaseWireMessages(messages: WireMessage[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || messages.length === 0) return false;

  try {
    const rows = messages.map(toSupabaseRow);
    const { error } = await client
      .from("wire_messages")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      console.warn("[Supabase] Upsert error:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Supabase] save error:", err);
    return false;
  }
}

/**
 * Mark a view-once message as burned in Supabase
 */
export async function burnSupabaseWireMessage(messageId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from("wire_messages")
      .update({ is_burned: true })
      .eq("id", messageId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Toggle message pin state in Supabase
 */
export async function togglePinSupabaseWireMessage(messageId: string, isPinned: boolean): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from("wire_messages")
      .update({ is_pinned: isPinned })
      .eq("id", messageId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Update message delivery / read status in Supabase
 */
export async function updateStatusSupabaseWireMessage(
  messageId: string,
  status: WireMessage["status"]
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from("wire_messages")
      .update({ status })
      .eq("id", messageId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Add reaction in Supabase
 */
export async function addReactionSupabaseWireMessage(
  messageId: string,
  userId: string,
  emoji: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    // Read current reactions
    const { data } = await client
      .from("wire_messages")
      .select("reactions")
      .eq("id", messageId)
      .single();

    const currentReactions = (data?.reactions as Record<string, string>) || {};
    currentReactions[userId] = emoji;

    const { error } = await client
      .from("wire_messages")
      .update({ reactions: currentReactions })
      .eq("id", messageId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Wipe all wire messages from Supabase (Emergency Wipe)
 */
export async function wipeSupabaseWireMessages(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from("wire_messages")
      .delete()
      .neq("id", "none");

    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetch public key directory from Supabase
 */
export async function fetchSupabasePublicKeys(): Promise<Record<string, { userId: string; fingerprint: string; keyRotationVersion: number }> | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.from("public_keys").select("*");
    if (error || !data) return null;

    const result: Record<string, { userId: string; fingerprint: string; keyRotationVersion: number }> = {};
    for (const row of data) {
      result[row.user_id] = {
        userId: row.user_id,
        fingerprint: row.fingerprint,
        keyRotationVersion: row.key_rotation_version,
      };
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Upsert user public key into Supabase
 */
export async function upsertSupabasePublicKey(entry: {
  userId: string;
  fingerprint: string;
  keyRotationVersion: number;
}): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from("public_keys").upsert({
      user_id: entry.userId,
      fingerprint: entry.fingerprint,
      key_rotation_version: entry.keyRotationVersion,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}
