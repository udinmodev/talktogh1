import { NextResponse } from "next/server";
import { serverEncrypt, deriveServerPairKey } from "@/lib/server-crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { data, text, senderId, recipientId, customKey, epoch = 1 } = body;

    const actualSender = senderId ? String(senderId).toLowerCase() : "anonymous";
    const actualRecipient = recipientId ? String(recipientId).toLowerCase() : "anonymous";

    if (!data && !text) {
      return NextResponse.json({ success: false, error: "Missing data or text to encrypt" }, { status: 400 });
    }

    const payloadContent = data || { text: String(text || "") };

    // Resolve or derive key on server
    let key = customKey;
    if (!key) {
      const derived = deriveServerPairKey(actualSender, actualRecipient, Number(epoch) || 1);
      key = derived.sessionKeyHex;
    }

    const encrypted = serverEncrypt(payloadContent, key, actualSender, actualRecipient, Number(epoch) || 1);

    return NextResponse.json({
      success: true,
      encryptedPayload: encrypted,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Server encryption failed: ${err.message}` },
      { status: 500 }
    );
  }
}
