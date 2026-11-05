import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/types/chat";

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
        return NextResponse.json({
          success: true,
          storage: "cloud-database",
          settings: { ...DEFAULT_SETTINGS, ...res.rows[0].settings },
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
        return NextResponse.json({
          success: true,
          storage: "cloud-auth-metadata",
          settings: { ...DEFAULT_SETTINGS, ...authRes.rows[0].settings },
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
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
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
    const pool = getDbPool();

    if (pool) {
      // 1. Persist to public.user_accounts.settings
      await pool.query(
        `UPDATE public.user_accounts 
         SET settings = $1 
         WHERE lower(id) = $2 OR lower(username) = $2`,
        [JSON.stringify(settings), cleanUser]
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
        [JSON.stringify(settings), cleanUser]
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
