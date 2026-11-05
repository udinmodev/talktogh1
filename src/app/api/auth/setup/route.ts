import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getDbPool } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, pin, biometricEnabled, credentialId } = body;

    const rawUser = String(username || "").trim().toLowerCase();
    const cleanUser = (rawUser.includes("@") ? rawUser.split("@")[0] : rawUser).replace(/[^a-zA-Z0-9._-]/g, "");

    if (!cleanUser || !pin) {
      return NextResponse.json(
        { success: false, error: "Username and PIN are required." },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { success: false, error: "Supabase database not configured." },
        { status: 500 }
      );
    }

    const pool = getDbPool();

    // 1. Update user_metadata in auth.users
    if (pool) {
      try {
        await pool.query(
          `UPDATE auth.users
           SET raw_user_meta_data = jsonb_set(
             jsonb_set(
               jsonb_set(
                 COALESCE(raw_user_meta_data, '{}'::jsonb),
                 '{pin}', to_jsonb($1::text)
               ),
               '{has_pin}', 'true'::jsonb
             ),
             '{biometric_enabled}', to_jsonb($2::boolean)
           )
           WHERE lower(COALESCE(raw_user_meta_data->>'username', email)) = $3
              OR lower(email) LIKE $4`,
          [String(pin), Boolean(biometricEnabled), cleanUser, `${cleanUser}@%`]
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
      message: "Security credentials saved directly to Supabase.",
      pinSet: true,
      biometricEnabled: Boolean(biometricEnabled),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
