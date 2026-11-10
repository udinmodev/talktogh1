import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/types/chat";

// Strict security sanitizer: Purge any plaintext PIN or credentials from settings
function sanitizeSettings(raw: any) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const s = { ...DEFAULT_SETTINGS, ...raw };
  delete (s as any).appLockPin;
  delete (s as any).pin;
  delete (s as any).correctPin;
  delete (s as any).lockPin;
  return s;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim().toLowerCase();

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });
    }

    const cleanUser = userId.split("@")[0].toLowerCase();
    const pool = getDbPool();

    if (pool) {
      const res = await pool.query(
        `SELECT settings FROM public.user_accounts 
         WHERE lower(id) = $1 OR lower(username) = $1 
         LIMIT 1`,
        [cleanUser]
      );

      if (res.rows.length > 0 && res.rows[0].settings && Object.keys(res.rows[0].settings).length > 0) {
        const raw = res.rows[0].settings;
        const userSettings = sanitizeSettings(raw);

        if (raw.disappearingTimer === 30 && !raw.explicitDisappearingTimer) {
          userSettings.disappearingTimer = 0;
        }

        // Asynchronously purge plaintext pin from database if present
        if (raw.appLockPin || raw.pin || raw.correctPin) {
          pool.query(
            `UPDATE public.user_accounts 
             SET settings = settings - 'appLockPin' - 'pin' - 'correctPin' - 'lockPin'
             WHERE lower(id) = $1 OR lower(username) = $1`,
            [cleanUser]
          ).catch((e) => console.warn("Notice cleaning user_accounts pin:", e));
        }

        return NextResponse.json({
          success: true,
          storage: "cloud-database",
          settings: userSettings,
        });
      }

      // Fallback to auth.users raw_user_meta_data
      const authRes = await pool.query(
        `SELECT raw_user_meta_data->'settings' as settings FROM auth.users 
         WHERE lower(raw_user_meta_data->>'username') = $1 
            OR lower(email) = $1 
            OR lower(split_part(email, '@', 1)) = $1
         LIMIT 1`,
        [cleanUser]
      );

      if (authRes.rows.length > 0 && authRes.rows[0].settings) {
        const rawAuth = authRes.rows[0].settings;
        const authSettings = sanitizeSettings(rawAuth);

        if (rawAuth.disappearingTimer === 30 && !rawAuth.explicitDisappearingTimer) {
          authSettings.disappearingTimer = 0;
        }

        // Asynchronously purge plaintext pin from auth.users metadata if present
        if (rawAuth.appLockPin || rawAuth.pin || rawAuth.correctPin) {
          pool.query(
            `UPDATE auth.users 
             SET raw_user_meta_data = (
               jsonb_set(
                 raw_user_meta_data,
                 '{settings}',
                 COALESCE(raw_user_meta_data->'settings', '{}'::jsonb) - 'appLockPin' - 'pin' - 'correctPin' - 'lockPin'
               ) - 'pin'
             )
             WHERE lower(raw_user_meta_data->>'username') = $1 
                OR lower(email) = $1 
                OR lower(split_part(email, '@', 1)) = $1`,
            [cleanUser]
          ).catch((e) => console.warn("Notice cleaning auth.users pin:", e));
        }

        return NextResponse.json({
          success: true,
          storage: "cloud-auth-metadata",
          settings: authSettings,
        });
      }
    }

    return NextResponse.json({
      success: true,
      storage: "default",
      settings: DEFAULT_SETTINGS,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("[Settings] GET failed, returning defaults:", msg);
    return NextResponse.json({
      success: true,
      storage: "default",
      settings: DEFAULT_SETTINGS,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, settings } = body;

    if (!userId || !settings) {
      return NextResponse.json(
        { success: false, error: "userId and settings are required" },
        { status: 400 }
      );
    }

    const cleanUser = String(userId).trim().split("@")[0].toLowerCase();
    // Guarantee zero plaintext PINs can ever be persisted to settings
    const sanitizedSettings = sanitizeSettings(settings);
    const pool = getDbPool();

    if (pool) {
      // 1. Persist to public.user_accounts.settings
      await pool.query(
        `UPDATE public.user_accounts 
         SET settings = $1 
         WHERE lower(id) = $2 OR lower(username) = $2`,
        [JSON.stringify(sanitizedSettings), cleanUser]
      );

      // 2. Persist to auth.users metadata
      await pool.query(
        `UPDATE auth.users 
         SET raw_user_meta_data = jsonb_set(
           COALESCE(raw_user_meta_data, '{}'::jsonb),
           '{settings}',
           $1::jsonb
         )
         WHERE lower(raw_user_meta_data->>'username') = $2 
            OR lower(email) = $2 
            OR lower(split_part(email, '@', 1)) = $2`,
        [JSON.stringify(sanitizedSettings), cleanUser]
      );
    }

    return NextResponse.json({
      success: true,
      storage: "cloud-database",
      savedAt: Date.now(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
