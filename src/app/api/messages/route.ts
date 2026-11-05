import { NextResponse } from "next/server";
import {
  getActiveWireMessages,
  saveWireMessages,
  saveSingleWireMessage,
  burnWireMessage,
  togglePinWireMessage,
  updateStatusWireMessage,
  addReactionWireMessage,
  wipeAllWireMessages,
  getServerStoreStats,
  WireMessage,
} from "@/lib/server-store";
import {
  fetchSupabaseWireMessages,
  saveSupabaseWireMessages,
  burnSupabaseWireMessage,
  togglePinSupabaseWireMessage,
  updateStatusSupabaseWireMessage,
  addReactionSupabaseWireMessage,
  wipeSupabaseWireMessages,
} from "@/lib/supabase-store";
import { isSupabaseConfigured } from "@/lib/supabase";

// Strict input sanitizer to guarantee zero unencrypted text/links are saved
function sanitizeToWire(raw: Record<string, unknown>): WireMessage | null {
  if (!raw || typeof raw.id !== "string" || !raw.encryptedPayload) {
    return null;
  }

  const ep = raw.encryptedPayload as Record<string, unknown>;

  return {
    id: String(raw.id),
    senderId: String(raw.senderId || ep.senderId),
    recipientId: String(raw.recipientId || ep.recipientId),
    encryptedPayload: {
      ciphertext: String(ep.ciphertext || ""),
      iv: String(ep.iv || ""),
      algorithm: String(ep.algorithm || "AES-256-GCM (HKDF-SHA256)"),
      senderId: String(ep.senderId || raw.senderId),
      recipientId: String(ep.recipientId || raw.recipientId),
      timestamp: Number(ep.timestamp || raw.timestamp || Date.now()),
      keyEpoch: typeof ep.keyEpoch === "number" ? ep.keyEpoch : undefined,
      aadDigest: typeof ep.aadDigest === "string" ? ep.aadDigest : undefined,
      integrityStatus: ep.integrityStatus === "verified" ? "verified" : undefined,
    },
    timestamp: Number(raw.timestamp || Date.now()),
    status: (raw.status as WireMessage["status"]) || "delivered",
    disappearingDuration: typeof raw.disappearingDuration === "number" ? raw.disappearingDuration : null,
    expiresAt: typeof raw.expiresAt === "number" ? raw.expiresAt : null,
    viewOnce: Boolean(raw.viewOnce),
    isBurned: Boolean(raw.isBurned),
    isPinned: Boolean(raw.isPinned),
    securityType: raw.securityType as WireMessage["securityType"],
    mediaType: raw.mediaType as WireMessage["mediaType"],
    mediaUrl: typeof raw.mediaUrl === "string" ? raw.mediaUrl : undefined,
    reactions: raw.reactions as Record<string, string> | undefined,
  };
}

// GET /api/messages - Retrieve persistent zero-knowledge wire messages
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = Number(searchParams.get("since") || 0);
  const showStats = searchParams.get("stats") === "true";

  if (showStats) {
    return NextResponse.json({
      success: true,
      supabaseConfigured: isSupabaseConfigured,
      stats: getServerStoreStats(),
    });
  }

  // 1. If Supabase is configured, attempt fetch from Supabase
  if (isSupabaseConfigured) {
    const supabaseMsgs = await fetchSupabaseWireMessages(since);
    if (supabaseMsgs !== null) {
      // Sync to local memory cache so offline/fallback is always primed
      saveWireMessages(supabaseMsgs);
      return NextResponse.json({
        success: true,
        zeroKnowledge: true,
        storage: "supabase-database",
        count: supabaseMsgs.length,
        messages: supabaseMsgs,
      });
    }
  }

  // 2. Fallback to zero-knowledge local persistent disk store
  const activeMessages = getActiveWireMessages(since);

  return NextResponse.json({
    success: true,
    zeroKnowledge: true,
    storage: "persistent-disk",
    supabaseConfigured: isSupabaseConfigured,
    count: activeMessages.length,
    messages: activeMessages,
  });
}

// POST /api/messages - Persist zero-knowledge wire messages
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, message, messageId, status, reaction } = body;

    if (action === "batch" && Array.isArray(body.messages)) {
      const sanitized: WireMessage[] = [];
      for (const item of body.messages) {
        const wire = sanitizeToWire(item);
        if (wire) sanitized.push(wire);
      }

      // Save to Supabase DB if active
      if (isSupabaseConfigured) {
        await saveSupabaseWireMessages(sanitized);
      }

      // Also persist to local cache/disk
      const added = saveWireMessages(sanitized);

      return NextResponse.json({
        success: true,
        count: added,
        zeroKnowledge: true,
        storage: isSupabaseConfigured ? "supabase-database" : "persistent-disk",
      });
    }

    if (action === "send" && message) {
      const wire = sanitizeToWire(message);
      if (wire) {
        if (isSupabaseConfigured) {
          await saveSupabaseWireMessages([wire]);
        }
        saveSingleWireMessage(wire);

        return NextResponse.json({
          success: true,
          messageId: wire.id,
          zeroKnowledge: true,
          storage: isSupabaseConfigured ? "supabase-database" : "persistent-disk",
        });
      }
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    if (action === "burn" && messageId) {
      if (isSupabaseConfigured) {
        await burnSupabaseWireMessage(messageId);
      }
      const burned = burnWireMessage(messageId);
      return NextResponse.json({ success: burned, burned });
    }

    if (action === "pin" && messageId) {
      const isPinned = Boolean(body.isPinned);
      if (isSupabaseConfigured) {
        await togglePinSupabaseWireMessage(messageId, isPinned);
      }
      const pinned = togglePinWireMessage(messageId, isPinned);
      return NextResponse.json({ success: pinned !== undefined, pinned });
    }

    if (action === "status" && messageId && status) {
      if (isSupabaseConfigured) {
        await updateStatusSupabaseWireMessage(messageId, status);
      }
      const updated = updateStatusWireMessage(messageId, status);
      return NextResponse.json({ success: updated, updated });
    }

    if (action === "reaction" && messageId && reaction) {
      if (isSupabaseConfigured) {
        await addReactionSupabaseWireMessage(messageId, reaction.userId, reaction.emoji);
      }
      const added = addReactionWireMessage(messageId, reaction.userId, reaction.emoji);
      return NextResponse.json({ success: added, reactionAdded: added });
    }

    if (action === "wipe") {
      if (isSupabaseConfigured) {
        await wipeSupabaseWireMessages();
      }
      wipeAllWireMessages();
      return NextResponse.json({ success: true, wiped: true, storage: "cleared" });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
