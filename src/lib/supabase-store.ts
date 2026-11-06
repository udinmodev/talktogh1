import { getSupabaseClient, getSupabaseAdminClient, isSupabaseConfigured } from "./supabase";
import { WireMessage } from "./server-store";
import { getDbPool } from "./db";
import {
  type SupabaseWireRow,
  toSupabaseRow,
  fromSupabaseRow,
} from "@/types/wire";
export {
  type SupabaseWireRow,
  toSupabaseRow,
  fromSupabaseRow,
};

/**
 * Fetch all active wire messages from Supabase
 */
export async function fetchSupabaseWireMessages(since: number = 0): Promise<WireMessage[] | null> {
  const pool = getDbPool();
  if (pool) {
    try {
      const now = Date.now();
      const res = await pool.query(
        `SELECT id, sender_id, recipient_id, encrypted_payload, timestamp, status,
                disappearing_duration, expires_at, view_once, is_burned, is_pinned,
                security_type, media_type, media_url, reactions
         FROM public.wire_messages
         WHERE ($1::bigint = 0 OR timestamp > $1::bigint)
           AND (expires_at IS NULL OR expires_at > $2::bigint)
         ORDER BY timestamp ASC`,
        [since, now]
      );
      return res.rows.map((row) => ({
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        encryptedPayload: typeof row.encrypted_payload === "string" ? JSON.parse(row.encrypted_payload) : row.encrypted_payload,
        timestamp: Number(row.timestamp),
        status: row.status,
        disappearingDuration: row.disappearing_duration,
        expiresAt: row.expires_at ? Number(row.expires_at) : null,
        viewOnce: Boolean(row.view_once),
        isBurned: Boolean(row.is_burned),
        isPinned: Boolean(row.is_pinned),
        securityType: row.security_type,
        mediaType: row.media_type,
        mediaUrl: row.media_url,
        reactions: typeof row.reactions === "string" ? JSON.parse(row.reactions) : row.reactions || {},
      }));
    } catch (e: any) {
      console.warn("[Pool] Fetch wire_messages fallback:", e.message);
    }
  }

  const client = getSupabaseAdminClient() || getSupabaseClient();
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
  if (messages.length === 0) return true;

  // 1. Direct PostgreSQL connection (Bypasses RLS)
  const pool = getDbPool();
  if (pool) {
    try {
      for (const m of messages) {
        await pool.query(
          `INSERT INTO public.wire_messages (
             id, sender_id, recipient_id, encrypted_payload, timestamp, status,
             disappearing_duration, expires_at, view_once, is_burned, is_pinned,
             security_type, media_type, media_url, reactions
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             is_pinned = EXCLUDED.is_pinned,
             is_burned = EXCLUDED.is_burned,
             reactions = EXCLUDED.reactions`,
          [
            m.id,
            m.senderId,
            m.recipientId,
            JSON.stringify(m.encryptedPayload),
            m.timestamp,
            m.status || "delivered",
            m.disappearingDuration || null,
            m.expiresAt || null,
            Boolean(m.viewOnce),
            Boolean(m.isBurned),
            Boolean(m.isPinned),
            m.securityType || "standard",
            m.mediaType || null,
            m.mediaUrl || null,
            JSON.stringify(m.reactions || {}),
          ]
        );
      }
      return true;
    } catch (poolErr: any) {
      console.warn("[Pool] Save wire messages notice:", poolErr.message);
    }
  }

  // 2. Supabase API fallback
  const client = getSupabaseAdminClient() || getSupabaseClient();
  if (!client) return false;

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

export interface SupabaseUserAccountRow {
  id: string;
  username: string;
  name: string;
  avatar: string;
  has_pin: boolean;
  biometric_enabled: boolean;
  biometric_credential_id?: string | null;
  created_at: string;
}

/**
 * Fetch all registered user accounts from Supabase
 */
export async function fetchSupabaseUserAccounts(): Promise<SupabaseUserAccountRow[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("user_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) return null;
    return data as SupabaseUserAccountRow[];
  } catch {
    return null;
  }
}

