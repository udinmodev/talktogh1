import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { getDbPool } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, name, email: directEmail } = body;

    const rawUser = String(username || "").trim().toLowerCase();
    // Strip @domain to make sure usernames never contain @gmail.com or other email domains
    const cleanUser = (rawUser.includes("@") ? rawUser.split("@")[0] : rawUser).replace(/[^a-zA-Z0-9._-]/g, "");
    const displayName = String(name || cleanUser).trim();

    if (!cleanUser || cleanUser.length < 3) {
      return NextResponse.json(
        { success: false, error: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { success: false, error: "Database server is not configured." },
        { status: 500 }
      );
    }

    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Database connection failed." },
        { status: 500 }
      );
    }

    // Determine valid Supabase email:
    let emailToRegister = "";
    if (directEmail && String(directEmail).includes("@")) {
      emailToRegister = String(directEmail).trim().toLowerCase();
    } else if (rawUser.includes("@")) {
      emailToRegister = rawUser;
    } else {
      emailToRegister = `${cleanUser}@messenger.app`;
    }

    // 1. Check if username or email already exists in user_accounts or auth.users
    const pool = getDbPool();
    if (pool) {
      const existingRes = await pool.query(
        `SELECT a.id FROM public.user_accounts a
         LEFT JOIN auth.users u ON lower(u.email) = $2
         WHERE lower(a.username) = $1 OR a.id = $1 OR lower(u.email) = $2
         LIMIT 1`,
        [cleanUser, emailToRegister]
      );
      if (existingRes.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: "Username or email is already registered." },
          { status: 409 }
        );
      }
    }

    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      displayName
    )}`;

    // 2. Sign up user in Supabase Auth
    const { data: authData, error: signUpError } = await client.auth.signUp({
      email: emailToRegister,
      password: password,
      options: {
        data: {
          username: cleanUser,
          name: displayName,
          has_pin: false,
          biometric_enabled: false,
        },
      },
    });

    if (signUpError) {
      return NextResponse.json(
        { success: false, error: signUpError.message },
        { status: 400 }
      );
    }

    const authUserId = authData?.user?.id || cleanUser;

    // Auto-confirm user email directly via DB pool if unconfirmed
    if (pool && authData?.user?.id) {
      try {
        await pool.query(
          "UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1 AND email_confirmed_at IS NULL",
          [authData.user.id]
        );
      } catch (confirmErr) {
        console.warn("Auto-confirm notice:", confirmErr);
      }
    }

    // 3. Insert into public.user_accounts
    if (pool) {
      await pool.query(
        `INSERT INTO public.user_accounts (id, username, name, avatar, has_pin, biometric_enabled, created_at)
         VALUES ($1, $2, $3, $4, false, false, NOW())
         ON CONFLICT (id) DO UPDATE SET name = $3, avatar = $4`,
        [cleanUser, cleanUser, displayName, avatarUrl]
      );
    } else {
      await client.from("user_accounts").upsert({
        id: cleanUser,
        username: cleanUser,
        name: displayName,
        avatar: avatarUrl,
        has_pin: false,
        biometric_enabled: false,
        created_at: new Date().toISOString(),
      });
    }

    const userPayload = {
      id: cleanUser,
      username: cleanUser,
      name: displayName,
      avatar: avatarUrl,
      role: "owner" as const,
      hasPin: false,
      pin: "",
      biometricEnabled: false,
      isSecuritySetupComplete: false,
      createdAt: Date.now(),
    };

    return NextResponse.json({
      success: true,
      user: userPayload,
      database: "supabase-production",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
