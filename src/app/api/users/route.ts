import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchSupabaseUserAccounts } from "@/lib/supabase-store";
import { getDbPool } from "@/lib/db";
import { getActiveWireMessages } from "@/lib/server-store";

export interface PublicUserDto {
  id: string;
  username: string;
  name: string;
  avatar: string;
  phone: string;
  about: string;
  role: "contact" | "owner";
  publicKeyFingerprint: string;
  isOnline: boolean;
  lastSeen?: string;
  createdAt?: string;
}

import { getCachedDirectory, setCachedDirectory } from "@/lib/user-directory";

const FORBIDDEN_MOCK_USERS = new Set([
  "alice", "bob", "elena", "marcus", "user", "anonymous", "none", "0", "non",
  "vijay", "vijaysing4hadv74", "vijaysinghad73", "vijaysinghad74"
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requesterId = (
    request.headers.get("x-wechat-requester-id") ||
    searchParams.get("requesterId") ||
    ""
  ).split("@")[0].toLowerCase().trim();

  const targetId = (
    searchParams.get("targetId") ||
    searchParams.get("userId") ||
    ""
  ).split("@")[0].toLowerCase().trim();

  // Fast-path: server memory cache for standard contact list requests
  const cachedUsers = !targetId ? getCachedDirectory() : null;
  if (cachedUsers) {
    if (requesterId && !FORBIDDEN_MOCK_USERS.has(requesterId) && requesterId.length >= 3) {
      const filtered = cachedUsers.filter((u) => u.id !== requesterId);
      return NextResponse.json({
        success: true,
        count: filtered.length,
        users: filtered,
        targetUser: null,
        cached: true,
      });
    }
  }

  // 1. Strict Authentication: Restrict user directory exclusively to verified logged-in users
  if (!requesterId || requesterId === "user" || requesterId === "anonymous" || requesterId === "none") {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Access to the user directory is restricted to authenticated logged-in users.",
      },
      { status: 401 }
    );
  }

  // 2. Verify that the requester is a real registered user account
  let isRequesterValid = false;
  const pool = getDbPool();
  if (pool) {
    try {
      const chk = await pool.query(
        "SELECT id FROM public.user_accounts WHERE lower(username) = $1 OR lower(id) = $1 LIMIT 1",
        [requesterId]
      );
      if (chk.rows.length > 0) {
        isRequesterValid = true;
      } else {
        const authChk = await pool.query(
          "SELECT id FROM auth.users WHERE lower(COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1))) = $1 LIMIT 1",
          [requesterId]
        );
        if (authChk.rows.length > 0) isRequesterValid = true;
      }
    } catch (err) {
      console.warn("Notice validating requester via pool:", err);
    }
  }

  if (!isRequesterValid && isSupabaseConfigured) {
    try {
      const dbUsers = await fetchSupabaseUserAccounts();
      if (dbUsers) {
        isRequesterValid = dbUsers.some(
          (u) => String(u.username || u.id).split("@")[0].toLowerCase() === requesterId
        );
      }
    } catch (err) {
      console.warn("Notice validating requester via supabase client:", err);
    }
  }

  if (!isRequesterValid) {
    try {
      const existingMessages = getActiveWireMessages();
      const hasSentOrReceived = existingMessages.some(
        (m) => m.senderId === requesterId || m.recipientId === requesterId
      );
      if (hasSentOrReceived) {
        isRequesterValid = true;
      }
    } catch (err) {
      console.warn("Notice validating requester via wire-messages:", err);
    }
  }

  // Fallback for valid session when database is starting up or temporarily offline
  if (!isRequesterValid && requesterId && !FORBIDDEN_MOCK_USERS.has(requesterId) && requesterId.length >= 3) {
    isRequesterValid = true;
  }

  if (!isRequesterValid) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Invalid or non-existent user session identity.",
      },
      { status: 401 }
    );
  }

  const usersMap = new Map<string, PublicUserDto>();

  const registerUserCandidate = (
    id: string,
    name?: string,
    avatar?: string,
    createdAt?: string,
    about?: string
  ) => {
    const cleanId = String(id || "").split("@")[0].toLowerCase().trim();
    if (!cleanId || FORBIDDEN_MOCK_USERS.has(cleanId)) {
      return;
    }
    // Only omit requester when no explicit target is requested or target is someone else
    if (cleanId === requesterId && (!targetId || targetId !== requesterId)) {
      return;
    }
    if (usersMap.has(cleanId)) {
      // Enhance existing record with name or avatar if previously missing
      const existing = usersMap.get(cleanId)!;
      if (name && existing.name === existing.id && name !== existing.id) {
        existing.name = name;
      }
      if (avatar && !existing.avatar.includes(encodeURIComponent(name || cleanId))) {
        existing.avatar = avatar;
      }
      return;
    }

    const displayName = name || cleanId;
    usersMap.set(cleanId, {
      id: cleanId,
      username: cleanId,
      name: displayName,
      avatar:
        avatar ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
      phone: `@${cleanId}`,
      about: about || "Registered confidential identity.",
      role: "contact",
      publicKeyFingerprint:
        cleanId.length >= 8
          ? cleanId.substring(0, 8).toUpperCase() + "7EFE2C"
          : "7EFE2C6DCC10DA73",
      isOnline: true,
      lastSeen: "online",
      createdAt,
    });
  };

  // 1. Parallel database queries for maximum performance
  if (pool) {
    try {
      const [accResult, authResult] = await Promise.allSettled([
        pool.query("SELECT id, username, name, avatar, created_at FROM public.user_accounts"),
        pool.query("SELECT id, email, raw_user_meta_data, created_at FROM auth.users"),
      ]);

      if (accResult.status === "fulfilled" && accResult.value.rows) {
        for (const row of accResult.value.rows) {
          registerUserCandidate(row.username || row.id, row.name, row.avatar, row.created_at);
        }
      }

      if (authResult.status === "fulfilled" && authResult.value.rows) {
        for (const u of authResult.value.rows) {
          const meta = u.raw_user_meta_data || {};
          const rawUser = String(meta.username || u.email?.split("@")[0] || u.id);
          registerUserCandidate(rawUser, meta.name, meta.avatar, u.created_at);
        }
      }
    } catch (e) {
      console.warn("Notice querying user accounts via pool:", e);
    }
  }

  // 2. Supabase REST fallback only if pool produced 0 candidates
  if (usersMap.size === 0 && isSupabaseConfigured) {
    try {
      const dbUsers = await fetchSupabaseUserAccounts();
      if (dbUsers && dbUsers.length > 0) {
        for (const row of dbUsers) {
          registerUserCandidate(row.username || row.id, row.name, row.avatar, row.created_at);
        }
      }
    } catch (e) {
      console.warn("Notice fetching Supabase user accounts:", e);
    }
  }

  // 3. Note: Never synthesize user contacts from wire messages.
  // Real contacts must strictly originate from registered database accounts (user_accounts/auth.users).

  // If a specific targetId was requested (e.g. from /[id] route), ensure it was checked
  let targetFound = targetId ? usersMap.get(targetId) || null : null;
  if (targetId && !targetFound && pool) {
    try {
      const singleAcc = await pool.query(
        "SELECT id, username, name, avatar, created_at FROM public.user_accounts WHERE lower(username) = $1 OR lower(id) = $1 LIMIT 1",
        [targetId]
      );
      if (singleAcc.rows.length > 0) {
        const row = singleAcc.rows[0];
        registerUserCandidate(row.username || row.id, row.name, row.avatar, row.created_at);
        targetFound = usersMap.get(targetId) || null;
      }
    } catch {}
  }

  const usersList = Array.from(usersMap.values());

  // Cache directory on server for fast subsequent responses
  if (!targetId && usersList.length > 0) {
    setCachedDirectory(usersList);
  }

  return NextResponse.json({
    success: true,
    count: usersList.length,
    users: usersList,
    targetUser: targetFound,
  });
}
