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

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const recipientId = cleanIdentifier(body.userId || body.recipientId);
    const senderId = cleanIdentifier(body.senderId) || "push-test";

    if (!recipientId || recipientId === "none" || recipientId === "user" || recipientId === senderId) {
      return NextResponse.json({ success: false, error: "A valid recipient userId is required." }, { status: 400 });
    }

    const now = Date.now();
    const wire: WireMessage = {
      id: `push-test-${now}`,
      senderId,
      recipientId,
      encryptedPayload: {
        ciphertext: "dGVzdA==",
        iv: "AAAAAAAAAAAAAAAA",
        algorithm: "test",
        senderId,
        recipientId,
        timestamp: now,
      },
      timestamp: now,
      status: "sent",
      securityType: "standard",
    };

    const result = await triggerTalkTogetherPushNotification(wire);
    return NextResponse.json({
      success: result.status === "sent" || result.status === "partial",
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Push test failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
