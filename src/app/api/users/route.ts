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

export async function GET() {
  const usersMap = new Map<string, PublicUserDto>();

  // Fetch all real registered users from Supabase
  if (isSupabaseConfigured) {
    try {
      const dbUsers = await fetchSupabaseUserAccounts();
      if (dbUsers && dbUsers.length > 0) {
        for (const row of dbUsers) {
          const cleanId = row.username || row.id;
          // Filter out any mock/fake legacy test IDs
          if (cleanId === "alice" || cleanId === "bob" || cleanId === "elena" || cleanId === "marcus") {
            continue;
          }

          usersMap.set(cleanId, {
            id: cleanId,
            username: cleanId,
            name: row.name || cleanId,
            avatar:
              row.avatar ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.name || cleanId)}`,
            phone: `@${cleanId}`,
            about: "Registered confidential identity.",
            role: "contact",
            publicKeyFingerprint:
              cleanId.length >= 8
                ? cleanId.substring(0, 8).toUpperCase() + "7EFE2C"
                : "7EFE2C6DCC10DA73",
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
