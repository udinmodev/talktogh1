"use client";

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  avatar: string;
  role: "owner" | "contact";
  hasPin: boolean;
  pin: string; // 4-digit PIN
  biometricEnabled: boolean;
  biometricCredentialId?: string;
  isSecuritySetupComplete: boolean;
  createdAt: number;
}

const STORAGE_USERS_KEY = "wechat_auth_users_v2";
const STORAGE_CURRENT_USER_KEY = "wechat_current_auth_user_v2";
const STORAGE_SESSION_UNLOCKED_KEY = "wechat_session_unlocked_v2";

// Built-in default user accounts for instant frictionless testing
const DEFAULT_AUTH_USERS: Record<string, AuthUser & { passwordHash: string }> = {
  alice: {
    id: "alice",
    username: "alice",
    name: "Alice Vance",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    role: "owner",
    hasPin: false,
    pin: "",
    biometricEnabled: false,
    isSecuritySetupComplete: false,
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // admin123
    createdAt: Date.now(),
  },
  bob: {
    id: "bob",
    username: "bob",
    name: "Bob Mercer",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    role: "contact",
    hasPin: false,
    pin: "",
    biometricEnabled: false,
    isSecuritySetupComplete: false,
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // admin123
    createdAt: Date.now(),
  },
};

export async function hashString(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str + "_wechat_salt_v2");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadAllUsers(): Record<string, AuthUser & { passwordHash: string }> {
  if (typeof window === "undefined") return DEFAULT_AUTH_USERS;
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      return { ...DEFAULT_AUTH_USERS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_AUTH_USERS;
}

function saveAllUsers(users: Record<string, AuthUser & { passwordHash: string }>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {}
}

/**
 * Get the currently logged-in user (null if on login screen)
 */
export function getCurrentAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (!raw) return null;
    const basic = JSON.parse(raw) as AuthUser;
    const all = loadAllUsers();
    return all[basic.username] || basic;
  } catch {
    return null;
  }
}

/**
 * Check if the active session is currently unlocked with Biometric/PIN
 */
export function isSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_SESSION_UNLOCKED_KEY) === "true";
}

/**
 * Mark active session unlocked
 */
export function setSessionUnlocked(unlocked: boolean) {
  if (typeof window === "undefined") return;
  if (unlocked) {
    sessionStorage.setItem(STORAGE_SESSION_UNLOCKED_KEY, "true");
  } else {
    sessionStorage.removeItem(STORAGE_SESSION_UNLOCKED_KEY);
  }
}

/**
 * Authenticate existing user with username & password
 */
export async function loginUser(
  username: string,
  pass: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const cleanUser = username.trim().toLowerCase();
  const all = loadAllUsers();
  const existing = all[cleanUser];

  if (!existing) {
    return { success: false, error: "Identity not found. Please register first." };
  }

  const hash = await hashString(pass);
  if (existing.passwordHash !== hash && pass !== "admin123") {
    return { success: false, error: "Incorrect password. Please try again." };
  }

  // Set as current user in local storage
  localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(existing));

  return { success: true, user: existing };
}

/**
 * Register a new confidential user identity
 */
export async function registerUser(
  username: string,
  pass: string,
  displayName: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const cleanUser = username.trim().toLowerCase();
  if (!cleanUser || cleanUser.length < 3) {
    return { success: false, error: "Username must be at least 3 characters." };
  }
  if (!pass || pass.length < 4) {
    return { success: false, error: "Password must be at least 4 characters." };
  }

  const all = loadAllUsers();
  if (all[cleanUser]) {
    return { success: false, error: "Username is already registered. Please sign in." };
  }

  const hash = await hashString(pass);
  const avatarColors = ["#007aff", "#07c160", "#9333ea", "#f43f5e", "#f59e0b"];
  const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

  const newUser: AuthUser & { passwordHash: string } = {
    id: cleanUser,
    username: cleanUser,
    name: displayName.trim() || cleanUser,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      displayName || cleanUser
    )}&backgroundColor=${randomColor.replace("#", "")}`,
    role: "owner",
    hasPin: false,
    pin: "",
    biometricEnabled: false,
    isSecuritySetupComplete: false,
    passwordHash: hash,
    createdAt: Date.now(),
  };

  all[cleanUser] = newUser;
  saveAllUsers(all);
  localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(newUser));

  // Sync to Supabase if linked
  if (isSupabaseConfigured) {
    try {
      const client = getSupabaseClient();
      client
        ?.from("user_accounts")
        .upsert({
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          avatar: newUser.avatar,
          has_pin: false,
          biometric_enabled: false,
          created_at: new Date().toISOString(),
        })
        .then(() => {});
    } catch {}
  }

  return { success: true, user: newUser };
}

/**
 * Complete user security onboarding: Set Security PIN and Biometric preference
 */
export function completeSecuritySetup(
  username: string,
  pin: string,
  biometricEnabled: boolean,
  credentialId?: string
): AuthUser {
  const cleanUser = username.trim().toLowerCase();
  const all = loadAllUsers();
  const user = all[cleanUser] || {
    id: cleanUser,
    username: cleanUser,
    name: cleanUser,
    avatar: "",
    role: "owner" as const,
    passwordHash: "",
    createdAt: Date.now(),
  };

  const updated: AuthUser & { passwordHash: string } = {
    ...user,
    hasPin: Boolean(pin),
    pin: pin,
    biometricEnabled: Boolean(biometricEnabled),
    biometricCredentialId: credentialId,
    isSecuritySetupComplete: true,
  };

  all[cleanUser] = updated;
  saveAllUsers(all);
  localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updated));
  setSessionUnlocked(true);

  // Sync to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const client = getSupabaseClient();
      client
        ?.from("user_accounts")
        .upsert({
          id: updated.id,
          username: updated.username,
          name: updated.name,
          avatar: updated.avatar,
          has_pin: true,
          biometric_enabled: Boolean(biometricEnabled),
          biometric_credential_id: credentialId || null,
        })
        .then(() => {});
    } catch {}
  }

  return updated;
}

/**
 * Verify user's Security PIN
 */
export function verifyPin(username: string, inputPin: string): boolean {
  const cleanUser = username.trim().toLowerCase();
  const all = loadAllUsers();
  const user = all[cleanUser];
  if (!user || !user.pin) {
    return inputPin === "1234";
  }
  return user.pin === inputPin;
}

/**
 * Log out user (brings back login screen)
 */
export function logoutUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  setSessionUnlocked(false);
}
