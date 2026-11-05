import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getDbPool } from "@/lib/db";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Please enter your username/email and password." },
        { status: 400 }
      );
    }

    const cleanInput = String(identifier).trim().toLowerCase();

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { success: false, error: "Database server is not configured." },
        { status: 500 }
      );
    }

    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Failed to connect to database." },
        { status: 500 }
      );
    }

    // 1. Resolve email address
    let emailToAuth = cleanInput;
    const pool = getDbPool();

    if (pool) {
      try {
        const userRes = await pool.query(
          `SELECT u.id, u.email, u.raw_user_meta_data, a.has_pin, a.biometric_enabled, a.name, a.avatar
           FROM auth.users u
           LEFT JOIN public.user_accounts a ON a.id = COALESCE(u.raw_user_meta_data->>'username', u.id)
           WHERE lower(u.email) = $1 
              OR lower(u.raw_user_meta_data->>'username') = $1
              OR lower(split_part(u.email, '@', 1)) = $1
              OR lower(u.id::text) = $1
           LIMIT 1`,
          [cleanInput]
        );

        if (userRes.rows.length > 0) {
          emailToAuth = userRes.rows[0].email;
        }
      } catch (poolErr) {
        console.warn("DB pool query notice:", poolErr);
      }
    }

    // If cleanInput is not an email and not found yet, default to internal domain
    if (!emailToAuth.includes("@")) {
      const safeLocal = cleanInput.replace(/[^a-zA-Z0-9._-]/g, "") || "user";
      emailToAuth = `${safeLocal}@messenger.app`;
    }

    // 2. Authenticate with Supabase Auth
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: emailToAuth,
      password: password,
    });

    if (signInError) {
      return NextResponse.json(
        { success: false, error: signInError.message },
        { status: 401 }
      );
    }

    const authUser = signInData.user;
    const meta = authUser.user_metadata || {};
    // Ensure username is clean handle without email domain
    const username = String(meta.username || authUser.email?.split("@")[0] || cleanInput.split("@")[0]).split("@")[0].toLowerCase();
    const displayName = meta.name || username;

    let hasPin = Boolean(meta.has_pin);
    let biometricEnabled = Boolean(meta.biometric_enabled);
    let pinHash = typeof meta.pin_hash === "string" ? meta.pin_hash : "";

    if (!pinHash && meta.pin) {
      // Legacy unhashed pin in DB: hash it immediately so plaintext is never exposed
      const salt = `talktogether_pin_salt_v2_${username}`;
      pinHash = crypto.pbkdf2Sync(String(meta.pin), salt, 100000, 32, "sha256").toString("hex");
    }

    if (pinHash) {
      hasPin = true;
    }

    // Load account settings from user_accounts
    if (pool) {
      try {
        const accRes = await pool.query(
          "SELECT * FROM public.user_accounts WHERE id = $1 LIMIT 1",
          [username]
        );
        if (accRes.rows.length > 0) {
          hasPin = Boolean(accRes.rows[0].has_pin) || hasPin;
          biometricEnabled = Boolean(accRes.rows[0].biometric_enabled);
        }
      } catch {}
    }

    const isSecuritySetupComplete = hasPin || biometricEnabled;

    const userPayload = {
      id: username,
      username: username,
      name: displayName,
      avatar:
        meta.avatar ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
      role: "owner" as const,
      hasPin,
      pinHash, // Salted PBKDF2 hash (Zero plaintext exposure)
      biometricEnabled,
      isSecuritySetupComplete,
      createdAt: Date.now(),
    };

    return NextResponse.json({
      success: true,
      user: userPayload,
      session: {
        accessToken: signInData.session?.access_token,
        refreshToken: signInData.session?.refresh_token,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal authentication error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
