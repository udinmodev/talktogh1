import { NextResponse } from "next/server";
import { triggerTalkTogetherPushNotification } from "@/lib/push-notifications";
import type { WireMessage } from "@/types/wire";

function cleanIdentifier(value: unknown): string {
  return String(value || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);
}

/**
 * Server-to-server push dispatch used by the WebSocket relay when it persists
 * a wire message. Protected by the internal API secret via proxy.ts.
 * Deduped by message id inside triggerTalkTogetherPushNotification.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const raw = (body && typeof body === "object" && "message" in body ? body.message : body) as
      | Partial<WireMessage>
      | undefined;

    const id = String(raw?.id || "").trim();
    const senderId = cleanIdentifier(raw?.senderId);
    const recipientId = cleanIdentifier(raw?.recipientId);
    const timestamp = Number(raw?.timestamp) || Date.now();
    const encryptedPayload = raw?.encryptedPayload;

    if (
      !id ||
      id.length > 128 ||
      !senderId ||
      !recipientId ||
      recipientId === "none" ||
      recipientId === senderId ||
      !encryptedPayload ||
      typeof encryptedPayload !== "object" ||
      typeof (encryptedPayload as { ciphertext?: unknown }).ciphertext !== "string" ||
      typeof (encryptedPayload as { iv?: unknown }).iv !== "string"
    ) {
      return NextResponse.json({ success: false, error: "Invalid wire message." }, { status: 400 });
    }

    const wire: WireMessage = {
      id,
      senderId,
      recipientId,
      encryptedPayload: encryptedPayload as WireMessage["encryptedPayload"],
      timestamp,
      status: (raw?.status as WireMessage["status"]) || "delivered",
      disappearingDuration: raw?.disappearingDuration ?? null,
      expiresAt: raw?.expiresAt ?? null,
      viewOnce: Boolean(raw?.viewOnce),
      securityType: raw?.securityType || "standard",
    };

    const result = await triggerTalkTogetherPushNotification(wire);
    return NextResponse.json({
      success: result.status === "sent" || result.status === "partial",
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Push dispatch failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
