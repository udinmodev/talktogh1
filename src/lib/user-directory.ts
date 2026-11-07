export interface CachedDirectoryUser {
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

interface CachedDirectory {
  timestamp: number;
  users: CachedDirectoryUser[];
}

let serverDirectoryCache: CachedDirectory | null = null;
const CACHE_TTL_MS = 10_000; // 10 seconds server microcache

export function getCachedDirectory(): CachedDirectoryUser[] | null {
  if (serverDirectoryCache && Date.now() - serverDirectoryCache.timestamp < CACHE_TTL_MS) {
    return serverDirectoryCache.users;
  }
  return null;
}

export function setCachedDirectory(users: CachedDirectoryUser[]): void {
  serverDirectoryCache = {
    timestamp: Date.now(),
    users,
  };
}

export function invalidateUserDirectoryCache(): void {
  serverDirectoryCache = null;
}
