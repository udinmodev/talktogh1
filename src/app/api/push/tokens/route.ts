import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { getSupabaseAdminClient, getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { isValidPushToken } from "@/lib/push-notifications";

function cleanUserId(value: unknown): string {
  return String(value || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);
}

function cleanPlatform(value: unknown): string {
  return String(value || "web")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32) || "web";
}

async function isKnownUserId(userId: string): Promise<boolean> {
  const pool = getDbPool();
  if (!pool) return true;

  try {
    const account = await pool.query(
      `SELECT 1 FROM public.user_accounts
       WHERE lower(username) = $1 OR lower(id) = $1
       LIMIT 1`,
      [userId]
    );
    if (account.rows.length > 0) return true;

    const authUser = await pool.query(
      `SELECT 1 FROM auth.users
       WHERE lower(raw_user_meta_data->>'username') = $1
          OR lower(split_part(email, '@', 1)) = $1
          OR lower(id::text) = $1
       LIMIT 1`,
      [userId]
    );
    return authUser.rows.length > 0;
  } catch (err) {
    console.warn("[Push Tokens] User verification notice:", err instanceof Error ? err.message : err);
    return true;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = cleanUserId(body.userId || body.user_id);
    const token = String(body.token || "").trim();
    const platform = cleanPlatform(body.platform);

    if (!userId || userId === "none" || userId === "user") {
      return NextResponse.json({ success: false, error: "A valid userId is required." }, { status: 400 });
    }
    if (!(await isKnownUserId(userId))) {
      return NextResponse.json({ success: false, error: "Unknown userId." }, { status: 403 });
    }
    if (!isValidPushToken(token)) {
      return NextResponse.json({ success: false, error: "A valid Firebase device token is required." }, { status: 400 });
    }

    let persisted = false;
    let storage = "unconfigured";
    const pool = getDbPool();

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO public.push_tokens (token, user_id, platform, last_seen_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           ON CONFLICT (token) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             platform = EXCLUDED.platform,
             last_seen_at = NOW(),
             updated_at = NOW()`,
          [token, userId, platform]
        );

        // Keep only the 10 most recently seen tokens per user (and drop
        // anything unseen for 30 days) so stale registrations cannot stack
        // up and cause duplicate notifications.
        await pool.query(
          `DELETE FROM public.push_tokens
           WHERE lower(user_id) = lower($1)
             AND (
               last_seen_at < NOW() - interval '30 days'
               OR (
                 token <> $2
                 AND token NOT IN (
                   SELECT token FROM public.push_tokens
                   WHERE lower(user_id) = lower($1)
                   ORDER BY last_seen_at DESC
                   LIMIT 10
                 )
               )
             )`,
          [userId, token]
        );

        persisted = true;
        storage = "postgres";
      } catch (err) {
        console.warn("[Push Tokens] Postgres registration notice:", err instanceof Error ? err.message : err);
      }
    }

    if (!persisted && isSupabaseConfigured) {
      try {
        const client = getSupabaseAdminClient() || getSupabaseClient();
        if (client) {
          const { error } = await client.from("push_tokens").upsert({
            token,
            user_id: userId,
            platform,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          if (!error) {
            persisted = true;
            storage = "supabase";
          }
        }
      } catch (err) {
        console.warn("[Push Tokens] Supabase registration notice:", err instanceof Error ? err.message : err);
      }
    }

    if (!persisted) {
      return NextResponse.json(
        { success: false, error: "Push token storage is unavailable. Apply the push_tokens schema first." },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, storage, userId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }

  try {
    const userId = cleanUserId(new URL(request.url).searchParams.get("userId"));
    if (!userId || userId === "none" || userId === "user") {
      return NextResponse.json({ success: false, error: "A valid userId is required." }, { status: 400 });
    }

    const rows: Array<{ platform: string; lastSeenAt: string | null }> = [];
    let storage = "unconfigured";
    const pool = getDbPool();

    if (pool) {
      try {
        const result = await pool.query(
          `SELECT platform, last_seen_at
           FROM public.push_tokens
           WHERE lower(user_id) = lower($1)
           ORDER BY last_seen_at DESC
           LIMIT 100`,
          [userId]
        );
        for (const row of result.rows) {
          rows.push({
            platform: String(row.platform || "web"),
            lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
          });
        }
        storage = "postgres";
      } catch (err) {
        console.warn("[Push Tokens] Postgres status notice:", err instanceof Error ? err.message : err);
      }
    }

    if (rows.length === 0 && isSupabaseConfigured) {
      try {
        const client = getSupabaseAdminClient() || getSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from("push_tokens")
            .select("platform,last_seen_at")
            .eq("user_id", userId)
            .order("last_seen_at", { ascending: false })
            .limit(100);
          if (!error && data) {
            for (const row of data as Array<{ platform?: string; last_seen_at?: string }>) {
              rows.push({
                platform: String(row.platform || "web"),
                lastSeenAt: row.last_seen_at || null,
              });
            }
            storage = "supabase";
          }
        }
      } catch (err) {
        console.warn("[Push Tokens] Supabase status notice:", err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      count: rows.length,
      lastSeenAt: rows[0]?.lastSeenAt || null,
      platforms: Array.from(new Set(rows.map((row) => row.platform))),
      storage,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const userId = cleanUserId(body.userId || body.user_id);

    if (!token && !userId) {
      return NextResponse.json({ success: false, error: "token or userId is required." }, { status: 400 });
    }
    if (process.env.NODE_ENV === "production" && !token) {
      return NextResponse.json({ success: false, error: "Production deletes require a device token." }, { status: 403 });
    }

    let removed = false;
    let storage = "unconfigured";
    const pool = getDbPool();

    if (pool) {
      try {
        const result = token
          ? await pool.query("DELETE FROM public.push_tokens WHERE token = $1", [token])
          : await pool.query("DELETE FROM public.push_tokens WHERE lower(user_id) = $1", [userId]);
        removed = (result.rowCount || 0) > 0;
        storage = "postgres";
      } catch (err) {
        console.warn("[Push Tokens] Postgres removal notice:", err instanceof Error ? err.message : err);
      }
    }

    if (!removed && isSupabaseConfigured) {
      try {
        const client = getSupabaseAdminClient() || getSupabaseClient();
        if (client) {
          const query = token
            ? client.from("push_tokens").delete().eq("token", token)
            : client.from("push_tokens").delete().eq("user_id", userId);
          const { error } = await query;
          if (!error) {
            removed = true;
            storage = "supabase";
          }
        }
      } catch (err) {
        console.warn("[Push Tokens] Supabase removal notice:", err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({ success: true, removed, storage });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
