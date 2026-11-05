import { NextResponse } from "next/server";
import { serverDecrypt, deriveServerPairKey, validateServerEnvelope } from "@/lib/server-crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { encryptedPayload, customKey } = body;

    if (!encryptedPayload) {
      return NextResponse.json({ success: false, error: "Missing encryptedPayload" }, { status: 400 });
    }

    const envelopeValidation = validateServerEnvelope(encryptedPayload);
    if (!envelopeValidation.valid) {
      return NextResponse.json(
        { success: false, error: `Invalid encrypted envelope: ${envelopeValidation.error}` },
        { status: 422 }
      );
    }

    let key = customKey;
    if (!key) {
      const derived = deriveServerPairKey(encryptedPayload.senderId, encryptedPayload.recipientId);
      key = derived.sessionKeyHex;
    }

    const result = serverDecrypt(encryptedPayload, key);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      text: result.text,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Server decryption failed: ${err.message}` },
      { status: 500 }
    );
  }
}
