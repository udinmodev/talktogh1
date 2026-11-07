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
    const cleanA = userA.toLowerCase().split("@")[0];
    const cleanB = userB.toLowerCase().split("@")[0];
    const derived = deriveServerPairKey(cleanA, cleanB, epoch);
    return NextResponse.json(
      {
        success: true,
        userA: cleanA,
        userB: cleanB,
        sessionKeyHex: derived.sessionKeyHex,
        sessionKeyBase64: derived.sessionKeyBase64,
        safetyNumber: derived.safetyNumber,
        algorithm: derived.algorithm,
        epoch: derived.epoch,
        timestamp: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        },
      }
    );
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
    const { userA, userB, pairs, epoch = 1 } = body;

    // Batch derivation support: e.g. { userA: "alice", pairs: ["bob", "charlie"] }
    if (userA && Array.isArray(pairs)) {
      const cleanA = String(userA).toLowerCase().split("@")[0];
      const results: Record<string, { sessionKeyBase64: string; safetyNumber: string; algorithm: string }> = {};

      for (const partner of pairs) {
        if (!partner) continue;
        const cleanB = String(partner).toLowerCase().split("@")[0];
        try {
          const derived = deriveServerPairKey(cleanA, cleanB, Number(epoch) || 1);
          results[cleanB] = {
            sessionKeyBase64: derived.sessionKeyBase64,
            safetyNumber: derived.safetyNumber,
            algorithm: derived.algorithm,
          };
        } catch {}
      }

      return NextResponse.json({
        success: true,
        userA: cleanA,
        batch: results,
        timestamp: Date.now(),
      });
    }

    if (!userA || !userB) {
      return NextResponse.json(
        { success: false, error: "Missing userA or userB in request body" },
        { status: 400 }
      );
    }

    const cleanA = String(userA).toLowerCase().split("@")[0];
    const cleanB = String(userB).toLowerCase().split("@")[0];
    const derived = deriveServerPairKey(cleanA, cleanB, Number(epoch) || 1);

    return NextResponse.json({
      success: true,
      userA: cleanA,
      userB: cleanB,
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
