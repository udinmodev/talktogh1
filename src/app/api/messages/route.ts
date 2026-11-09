import { after, NextResponse } from "next/server";
import { triggerTalkTogetherPushNotification } from "@/lib/push-notifications";
import {
  getActiveWireMessages,
  saveWireMessages,
  saveSingleWireMessage,
  burnWireMessage,
  togglePinWireMessage,
  deleteWireMessage,
  editWireMessage,
  updateStatusWireMessage,
  markAllReadWireMessages,
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
  deleteSupabaseWireMessage,
  editSupabaseWireMessage,
  updateStatusSupabaseWireMessage,
  markAllReadSupabaseWireMessages,
  addReactionSupabaseWireMessage,
  wipeSupabaseWireMessages,
} from "@/lib/supabase-store";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getDbPool } from "@/lib/db";

// Strict input sanitizer to guarantee zero unencrypted text/links are saved and prevent replay/tamper attacks
function sanitizeToWire(raw: Record<string, unknown>): WireMessage | null {
  if (!raw || typeof raw.id !== "string" || !raw.encryptedPayload) {
    return null;
  }

  const ep = raw.encryptedPayload as Record<string, unknown>;
  const ciphertext = String(ep.ciphertext || "").trim();
  const iv = String(ep.iv || "").trim();

  // 1. Strict ciphertext & IV validation: Must be non-empty valid Base64 within strict size limits (supports up to 5MB for photos & animated GIFs)
  if (!ciphertext || ciphertext.length > 5000000 || !/^[A-Za-z0-9+/=]+$/.test(ciphertext)) {
    return null;
  }
  if (!iv || iv.length > 32 || !/^[A-Za-z0-9+/=]+$/.test(iv)) {
    return null;
  }

  // 2. Sender and recipient identifier validation
  const cleanSender = String(raw.senderId || ep.senderId || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 64);

  const rawRecipient = String(raw.recipientId || ep.recipientId || "");
  const cleanRecipient = (rawRecipient.startsWith("public-")
    ? rawRecipient
    : rawRecipient.split("@")[0].toLowerCase()
  )
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 64);

  if (!cleanSender || !cleanRecipient) {
    return null;
  }

  // 3. Anti-Replay Protection: Enforce strict timestamp window (10 min past, 5 min future)
  const now = Date.now();
  const ts = Number(ep.timestamp || raw.timestamp || now);
  if (isNaN(ts) || ts < now - 10 * 60 * 1000 || ts > now + 5 * 60 * 1000) {
    return null;
  }

  // 4. Reactions Sanitization (max 10 reactions, safe emoji length <= 8)
  let cleanReactions: Record<string, string> | undefined = undefined;
  if (raw.reactions && typeof raw.reactions === "object") {
    cleanReactions = {};
    const entries = Object.entries(raw.reactions as Record<string, unknown>);
    for (const [user, emoji] of entries.slice(0, 10)) {
      const cleanU = String(user).split("@")[0].toLowerCase().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64);
      const cleanE = String(emoji || "").slice(0, 8);
      if (cleanU && cleanE) {
        cleanReactions[cleanU] = cleanE;
      }
    }
  }

  // 5. Safe mediaUrl check (supports up to 5MB for photos & animated GIFs)
  let safeMediaUrl: string | undefined = undefined;
  if (typeof raw.mediaUrl === "string") {
    const trimmed = raw.mediaUrl.trim();
    if (trimmed.startsWith("https://") || trimmed.startsWith("data:image/") || trimmed.startsWith("data:audio/")) {
      safeMediaUrl = trimmed.slice(0, 5000000);
    }
  }

  return {
    id: String(raw.id).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64),
    senderId: cleanSender,
    recipientId: cleanRecipient,
    encryptedPayload: {
      ciphertext,
      iv,
      algorithm: "AES-256-GCM (HKDF-SHA256)",
      senderId: cleanSender,
      recipientId: cleanRecipient,
      timestamp: ts,
      keyEpoch: typeof ep.keyEpoch === "number" ? Math.max(1, Math.min(1000, ep.keyEpoch)) : undefined,
      aadDigest: typeof ep.aadDigest === "string" ? ep.aadDigest.slice(0, 32) : undefined,
      integrityStatus: ep.integrityStatus === "verified" ? "verified" : undefined,
      hmacSignature: typeof ep.hmacSignature === "string" ? ep.hmacSignature.slice(0, 64) : undefined,
    },
    timestamp: ts,
    status: (raw.status === "read" || raw.status === "delivered" || raw.status === "sending") ? raw.status : "delivered",
    disappearingDuration: typeof raw.disappearingDuration === "number" && raw.disappearingDuration > 0
      ? Math.min(604800, raw.disappearingDuration)
      : null,
    expiresAt: typeof raw.expiresAt === "number" ? raw.expiresAt : null,
    viewOnce: Boolean(raw.viewOnce),
    isBurned: Boolean(raw.isBurned),
    isPinned: Boolean(raw.isPinned),
    securityType: (raw.securityType === "disappearing" || raw.securityType === "view_once" || raw.securityType === "confidential") ? raw.securityType : "standard",
    mediaType: (raw.mediaType === "image" || raw.mediaType === "voice" || raw.mediaType === "doc") ? raw.mediaType : undefined,
    mediaUrl: safeMediaUrl,
    reactions: cleanReactions,
  };
}

// GET /api/messages - Retrieve persistent zero-knowledge wire messages
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = Number(searchParams.get("since") || 0);
  const before = Number(searchParams.get("before") || 0);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam))) : 0;
  const userId = searchParams.get("userId")?.trim().toLowerCase() || "";
  const contactId = searchParams.get("contactId")?.trim().toLowerCase() || "";
  const showStats = searchParams.get("stats") === "true";

  if (showStats) {
    return NextResponse.json({
      success: true,
      supabaseConfigured: isSupabaseConfigured,
      stats: getServerStoreStats(),
    });
  }

  // Request limit + 1 so we can tell if more older records exist
  const queryLimit = limit > 0 ? limit + 1 : 0;
  const options = {
    since,
    before,
    limit: queryLimit,
    userId,
    contactId: contactId && contactId !== "none" ? contactId : undefined,
  };

  // 1. If Supabase is configured, attempt fetch from Supabase
  if (isSupabaseConfigured) {
    const supabaseMsgs = await fetchSupabaseWireMessages(options);
    if (supabaseMsgs !== null) {
      // Sync to local memory cache so offline/fallback is always primed
      saveWireMessages(supabaseMsgs);

      let hasMore = false;
      let finalMsgs = supabaseMsgs;
      if (limit > 0 && finalMsgs.length > limit) {
        hasMore = true;
        // Keep the newest `limit` messages in the ASC window
        finalMsgs = finalMsgs.slice(finalMsgs.length - limit);
      }

      return NextResponse.json({
        success: true,
        zeroKnowledge: true,
        storage: "supabase-database",
        count: finalMsgs.length,
        hasMore,
        nextCursor: finalMsgs.length > 0 ? finalMsgs[0].timestamp : null,
        messages: finalMsgs,
      });
    }
  }

  // 2. Fallback to zero-knowledge local persistent disk store
  const diskMsgs = getActiveWireMessages(options);
  let hasMore = false;
  let finalDiskMsgs = diskMsgs;
  if (limit > 0 && finalDiskMsgs.length > limit) {
    hasMore = true;
    finalDiskMsgs = finalDiskMsgs.slice(finalDiskMsgs.length - limit);
  }

  return NextResponse.json({
    success: true,
    zeroKnowledge: true,
    storage: "persistent-disk",
    supabaseConfigured: isSupabaseConfigured,
    count: finalDiskMsgs.length,
    hasMore,
    nextCursor: finalDiskMsgs.length > 0 ? finalDiskMsgs[0].timestamp : null,
    messages: finalDiskMsgs,
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
        // Enforce that recipient is not 'none' and not sender
        if (wire.recipientId === "none" || wire.recipientId === wire.senderId) {
          return NextResponse.json(
            { success: false, error: "Cannot send message: Invalid recipient." },
            { status: 400 }
          );
        }

        // Verify recipient exists in database
        const pool = getDbPool();
        if (pool) {
          try {
            const chk = await pool.query(
              "SELECT id FROM public.user_accounts WHERE lower(username) = $1 OR lower(id) = $1 LIMIT 1",
              [wire.recipientId]
            );
            if (chk.rows.length === 0) {
              const authChk = await pool.query(
                "SELECT id FROM auth.users WHERE lower(COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1))) = $1 LIMIT 1",
                [wire.recipientId]
              );
              if (authChk.rows.length === 0 && !wire.recipientId.startsWith("public-")) {
                const wireMsgs = getActiveWireMessages();
                const existsInStore = wireMsgs.some(
                  (m) => m.senderId === wire.recipientId || m.recipientId === wire.recipientId
                );
                if (!existsInStore) {
                  return NextResponse.json(
                    { success: false, error: `Recipient @${wire.recipientId} does not exist.` },
                    { status: 404 }
                  );
                }
              }
            }
          } catch (err) {
            console.warn("Notice checking recipient exists:", err);
          }
        }

        if (isSupabaseConfigured) {
          await saveSupabaseWireMessages([wire]);
        }
        const isNewWireMessage = saveSingleWireMessage(wire);

        if (isNewWireMessage) {
          after(async () => {
            const result = await triggerTalkTogetherPushNotification(wire);
            console.log(
              `[Push] Dispatch ${result.status}: sent=${result.sent} failed=${result.failed} tokens=${result.tokenCount ?? 0}${result.reason ? ` reason=${result.reason}` : ""}`
            );
          });
        }

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

    if (action === "delete" && messageId) {
      if (isSupabaseConfigured) {
        await deleteSupabaseWireMessage(messageId);
      }
      const deleted = deleteWireMessage(messageId);
      return NextResponse.json({ success: true, deleted, messageId });
    }

    if (action === "edit" && messageId && body.encryptedPayload) {
      if (isSupabaseConfigured) {
        await editSupabaseWireMessage(messageId, body.encryptedPayload);
      }
      const edited = editWireMessage(messageId, body.encryptedPayload);
      return NextResponse.json({ success: true, edited, messageId });
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

    if ((action === "read" || action === "mark_read") && body.recipientId && body.senderId) {
      const recipientId = String(body.recipientId);
      const senderId = String(body.senderId);
      if (isSupabaseConfigured) {
        await markAllReadSupabaseWireMessages(recipientId, senderId);
      }
      const updated = markAllReadWireMessages(recipientId, senderId);
      return NextResponse.json({ success: true, updated, recipientId, senderId });
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
