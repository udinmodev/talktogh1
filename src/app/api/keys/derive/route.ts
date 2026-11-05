import { NextResponse } from "next/server";
import { deriveServerPairKey, generateServerSafetyNumber } from "@/lib/server-crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userA = searchParams.get("userA") || searchParams.get("senderId");
  const userB = searchParams.get("userB") || searchParams.get("recipientId");
  const epoch = parseInt(searchParams.get("epoch") || "1", 10);

  if (!userA || !userB) {
    return NextResponse.json(
      { success: false, error: "Missing required userA and userB query parameters" },
      { status: 400 }
    );
  }

  try {
    const derived = deriveServerPairKey(userA, userB, epoch);
    return NextResponse.json({
      success: true,
      userA: userA.toLowerCase(),
      userB: userB.toLowerCase(),
      sessionKeyHex: derived.sessionKeyHex,
      sessionKeyBase64: derived.sessionKeyBase64,
      safetyNumber: derived.safetyNumber,
      algorithm: derived.algorithm,
      epoch: derived.epoch,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Key derivation failed: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userA, userB, epoch = 1 } = body;

    if (!userA || !userB) {
      return NextResponse.json(
        { success: false, error: "Missing userA or userB in request body" },
        { status: 400 }
      );
    }

    const derived = deriveServerPairKey(userA, userB, Number(epoch) || 1);
    return NextResponse.json({
      success: true,
      userA: String(userA).toLowerCase(),
      userB: String(userB).toLowerCase(),
      sessionKeyHex: derived.sessionKeyHex,
      sessionKeyBase64: derived.sessionKeyBase64,
      safetyNumber: derived.safetyNumber,
      algorithm: derived.algorithm,
      epoch: derived.epoch,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Key derivation failed: ${err.message}` },
      { status: 500 }
    );
  }
}
