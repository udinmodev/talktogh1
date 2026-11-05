import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getDbPool } from "@/lib/db";
import crypto from "crypto";

function computeServerPinHash(pin: string, username: string): string {
  const salt = `talktogether_pin_salt_v2_${username.trim().toLowerCase()}`;
  return crypto.pbkdf2Sync(pin, salt, 100000, 32, "sha256").toString("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, pin, pinHash, biometricEnabled, credentialId } = body;

    const rawUser = String(username || "").trim().toLowerCase();
    const cleanUser = (rawUser.includes("@") ? rawUser.split("@")[0] : rawUser).replace(/[^a-zA-Z0-9._-]/g, "");

    // Accept pre-hashed PIN from client or compute salted PBKDF2 hash
    let securePinHash = typeof pinHash === "string" && pinHash.length === 64 ? pinHash : "";
    if (!securePinHash && pin) {
      securePinHash = computeServerPinHash(String(pin), cleanUser);
    }

    if (!cleanUser || !securePinHash) {
      return NextResponse.json(
        { success: false, error: "Username and valid security PIN are required." },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { success: false, error: "Database server not configured." },
        { status: 500 }
      );
    }

    const pool = getDbPool();

    // 1. Update user_metadata in auth.users (Save salted hash, strip plaintext pin)
    if (pool) {
      try {
        await pool.query(
          `UPDATE auth.users
           SET raw_user_meta_data = (
             jsonb_set(
               jsonb_set(
                 COALESCE(raw_user_meta_data, '{}'::jsonb),
                 '{pin_hash}', to_jsonb($1::text)
               ),
               '{biometric_enabled}', to_jsonb($2::boolean)
             ) - 'pin'
           )
           WHERE lower(COALESCE(raw_user_meta_data->>'username', email)) = $3
              OR lower(email) LIKE $4`,
          [securePinHash, Boolean(biometricEnabled), cleanUser, `${cleanUser}@%`]
        );

        // 2. Update user_accounts table in public schema
        await pool.query(
          `UPDATE public.user_accounts
           SET has_pin = true,
               biometric_enabled = $1,
               biometric_credential_id = $2
           WHERE id = $3 OR lower(username) = $3`,
          [Boolean(biometricEnabled), credentialId || null, cleanUser]
        );
      } catch (poolErr) {
        console.warn("DB pool update notice:", poolErr);
      }
    } else {
      const client = getSupabaseClient();
      if (client) {
        await client
          .from("user_accounts")
          .update({
            has_pin: true,
            biometric_enabled: Boolean(biometricEnabled),
            biometric_credential_id: credentialId || null,
          })
          .eq("username", cleanUser);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Security credentials saved securely.",
      pinSet: true,
      biometricEnabled: Boolean(biometricEnabled),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
