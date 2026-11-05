import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchSupabasePublicKeys,
  upsertSupabasePublicKey,
} from "@/lib/supabase-store";

// Server-side identity & cryptographic fingerprint registry
// Allows client identity resolution and public key exchange
interface UserKeyEntry {
  userId: string;
  fingerprint: string;
  keyRotationVersion: number;
  lastSeen: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __WECHAT_KEY_REGISTRY__: Record<string, UserKeyEntry> | undefined;
}

if (!global.__WECHAT_KEY_REGISTRY__) {
  global.__WECHAT_KEY_REGISTRY__ = {};
}

const getRegistry = () => global.__WECHAT_KEY_REGISTRY__!;

export async function GET() {
  if (isSupabaseConfigured) {
    const supabaseKeys = await fetchSupabasePublicKeys();
    if (supabaseKeys && Object.keys(supabaseKeys).length > 0) {
      return NextResponse.json({
        success: true,
        storage: "supabase-database",
        users: supabaseKeys,
      });
    }
  }

  return NextResponse.json({
    success: true,
    storage: "local-registry",
    users: getRegistry(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, fingerprint, keyRotationVersion } = body;
    const registry = getRegistry();

    if (userId) {
      const entry: UserKeyEntry = {
        userId,
        fingerprint: fingerprint || registry[userId]?.fingerprint || "UNKNOWN",
        keyRotationVersion: keyRotationVersion || registry[userId]?.keyRotationVersion || 1,
        lastSeen: Date.now(),
      };
      registry[userId] = entry;

      if (isSupabaseConfigured) {
        await upsertSupabasePublicKey(entry);
      }

      return NextResponse.json({
        success: true,
        storage: isSupabaseConfigured ? "supabase-database" : "local-registry",
        updated: registry[userId],
      });
    }

    return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
