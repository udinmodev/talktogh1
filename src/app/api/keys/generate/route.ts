import { NextResponse } from "next/server";
import { generateServerKeyPair, generateServerAesKey } from "@/lib/server-crypto";
import { upsertSupabasePublicKey } from "@/lib/supabase-store";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId ? String(body.userId).trim().toLowerCase() : "anonymous";
    const type = body.type || "ecdh"; // 'ecdh' or 'aes'

    if (type === "aes") {
      const aesKey = generateServerAesKey();
      return NextResponse.json({
        success: true,
        type: "AES-256-GCM",
        keyHex: aesKey.keyHex,
        keyBase64: aesKey.keyBase64,
        timestamp: Date.now(),
      });
    }

    // Default: Generate ECDH P-256 Keypair on server
    const serverKp = generateServerKeyPair(userId);

    // Persist server-generated public fingerprint to database
    if (isSupabaseConfigured && userId !== "anonymous") {
      await upsertSupabasePublicKey({
        userId,
        fingerprint: serverKp.fingerprint,
        keyRotationVersion: 1,
      }).catch((err) => console.warn("Supabase key registry notice:", err.message));
    }

    return NextResponse.json({
      success: true,
      type: "ECDH-P256",
      userId,
      publicKeyHex: serverKp.publicKeyHex,
      privateKeyHex: serverKp.privateKeyHex,
      fingerprint: serverKp.fingerprint,
      publicKeyJwk: serverKp.publicKeyJwk,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Server key generation failed: ${err.message}` },
      { status: 500 }
    );
  }
}
