import fs from "fs";
import path from "path";
import { WireMessage } from "@/types/wire";
export type { WireMessage };

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "wire-messages.json");
const TMP_FILE = path.join(DATA_DIR, "wire-messages.tmp");

// In-memory cache for fast sub-millisecond retrieval
let inMemoryStore: WireMessage[] | null = null;

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[Server Store] Error creating data directory:", err);
  }
}

function loadFromDisk(): WireMessage[] {
  ensureDataDir();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[Server Store] Notice reading store file (creating fresh):", err);
  }
  return [];
}

function flushToDisk(messages: WireMessage[]): void {
  ensureDataDir();
  try {
    // Atomic write via temp file swap
    fs.writeFileSync(TMP_FILE, JSON.stringify(messages, null, 2), "utf-8");
    fs.renameSync(TMP_FILE, STORE_FILE);
  } catch (err) {
    console.error("[Server Store] Error saving store to disk:", err);
  }
}

function getStore(): WireMessage[] {
  if (inMemoryStore === null) {
    inMemoryStore = loadFromDisk();
  }
  return inMemoryStore;
}

/**
 * Auto-purge expired self-destructing messages
 */
function purgeExpired(messages: WireMessage[]): { active: WireMessage[]; purgedCount: number } {
  const now = Date.now();
  let purgedCount = 0;
  const active = messages.filter((m) => {
    if (m.expiresAt && m.expiresAt <= now) {
      purgedCount++;
      return false;
    }
    return true;
  });
  return { active, purgedCount };
}

/**
 * Retrieve active messages (with automatic expiration purge)
 */
export function getActiveWireMessages(since: number = 0): WireMessage[] {
  const store = getStore();
  const { active, purgedCount } = purgeExpired(store);

  if (purgedCount > 0) {
    inMemoryStore = active;
    flushToDisk(active);
  }

  return since > 0 ? active.filter((m) => m.timestamp > since) : active;
}

/**
 * Batch insert or update encrypted wire messages
 */
export function saveWireMessages(messages: WireMessage[]): number {
  const store = getStore();
  let added = 0;

  for (const msg of messages) {
    const existingIndex = store.findIndex((m) => m.id === msg.id);
    if (existingIndex >= 0) {
      // Update existing message status/pins without duplicating
      store[existingIndex] = { ...store[existingIndex], ...msg };
    } else {
      store.push(msg);
      added++;
    }
  }

  const { active } = purgeExpired(store);
  inMemoryStore = active;
  flushToDisk(active);
  return added;
}

/**
 * Save a single encrypted wire message
 */
export function saveSingleWireMessage(msg: WireMessage): boolean {
  return saveWireMessages([msg]) > 0;
}

/**
 * Mark a view-once message as burned
 */
export function burnWireMessage(messageId: string): boolean {
  const store = getStore();
  const target = store.find((m) => m.id === messageId);
  if (target) {
    target.isBurned = true;
    flushToDisk(store);
    return true;
  }
  return false;
}

/**
 * Toggle pin status for a message
 */
export function togglePinWireMessage(messageId: string, isPinned?: boolean): boolean | undefined {
  const store = getStore();
  const target = store.find((m) => m.id === messageId);
  if (target) {
    target.isPinned = isPinned !== undefined ? isPinned : !target.isPinned;
    flushToDisk(store);
    return target.isPinned;
  }
  return undefined;
}

/**
 * Update message delivery/read status
 */
export function updateStatusWireMessage(messageId: string, status: WireMessage["status"]): boolean {
  const store = getStore();
  const target = store.find((m) => m.id === messageId);
  if (target) {
    target.status = status;
    flushToDisk(store);
    return true;
  }
  return false;
}

/**
 * Add emoji reaction to a message
 */
export function addReactionWireMessage(messageId: string, userId: string, emoji: string): boolean {
  const store = getStore();
  const target = store.find((m) => m.id === messageId);
  if (target) {
    target.reactions = {
      ...(target.reactions || {}),
      [userId]: emoji,
    };
    flushToDisk(store);
    return true;
  }
  return false;
}

/**
 * Emergency wipe: purge all stored wire messages from memory and disk
 */
export function wipeAllWireMessages(): void {
  inMemoryStore = [];
  flushToDisk([]);
}

/**
 * Return server store telemetry
 */
export function getServerStoreStats() {
  const active = getActiveWireMessages();
  return {
    storageType: "Persistent Disk + Memory Cache (JSON)",
    storagePath: STORE_FILE,
    totalMessages: active.length,
    pinnedMessages: active.filter((m) => m.isPinned).length,
    disappearingActive: active.filter((m) => m.expiresAt).length,
    viewOnceActive: active.filter((m) => m.viewOnce && !m.isBurned).length,
    lastSync: Date.now(),
  };
}
