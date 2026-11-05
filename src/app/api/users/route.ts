import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchSupabaseUserAccounts } from "@/lib/supabase-store";

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

const DEFAULT_USERS: PublicUserDto[] = [
  {
    id: "alice",
    username: "alice",
    name: "Alice Vance",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    phone: "@alice",
    about: "Using confidential E2EE messenger.",
    role: "owner",
    publicKeyFingerprint: "A9F438B2C19E77A0",
    isOnline: true,
    lastSeen: "online",
  },
  {
    id: "bob",
    username: "bob",
    name: "Bob Mercer",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    phone: "@bob",
    about: "Using confidential E2EE messenger.",
    role: "contact",
    publicKeyFingerprint: "E730D8192BF04C61",
    isOnline: true,
    lastSeen: "online",
  },
];

export async function GET() {
  const usersMap = new Map<string, PublicUserDto>();

  // Add default baseline users
  DEFAULT_USERS.forEach((u) => usersMap.set(u.id, u));

  // If Supabase is configured, fetch all live registered users
  if (isSupabaseConfigured) {
    try {
      const dbUsers = await fetchSupabaseUserAccounts();
      if (dbUsers && dbUsers.length > 0) {
        for (const row of dbUsers) {
          const cleanId = row.username || row.id;
          usersMap.set(cleanId, {
            id: cleanId,
            username: cleanId,
            name: row.name || cleanId,
            avatar: row.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.name || cleanId)}`,
            phone: `@${cleanId}`,
            about: "Registered confidential identity.",
            role: "contact",
            publicKeyFingerprint: cleanId.length >= 8 ? cleanId.substring(0, 8).toUpperCase() + "7EFE2C" : "7EFE2C6DCC10DA73",
            isOnline: true,
            lastSeen: "online",
            createdAt: row.created_at,
          });
        }
      }
    } catch (e) {
      console.warn("Failed to fetch Supabase users:", e);
    }
  }

  const usersList = Array.from(usersMap.values());

  return NextResponse.json({
    success: true,
    count: usersList.length,
    users: usersList,
  });
}
