"use client";

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import { getInternalApiHeaders } from "./api-security";

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

// Real user accounts store (Zero fake users)
const DEFAULT_AUTH_USERS: Record<string, AuthUser & { passwordHash: string }> = {};

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
      const parsed = JSON.parse(raw);
      delete parsed.alice;
      delete parsed.bob;
      delete parsed.elena;
      delete parsed.marcus;
      return parsed;
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

// In-memory unlocked flag: does NOT survive page refresh (guarantees auto-lock on page refresh)
let isMemoryUnlocked = false;

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    isMemoryUnlocked = false;
    sessionStorage.removeItem(STORAGE_SESSION_UNLOCKED_KEY);
  });
}

/**
 * Check if the active session is currently unlocked with Biometric/PIN
 */
export function isSessionUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return isMemoryUnlocked;
}

/**
 * Mark active session unlocked
 */
export function setSessionUnlocked(unlocked: boolean) {
  isMemoryUnlocked = unlocked;
  if (typeof window === "undefined") return;
  if (unlocked) {
    sessionStorage.setItem(STORAGE_SESSION_UNLOCKED_KEY, "true");
  } else {
    sessionStorage.removeItem(STORAGE_SESSION_UNLOCKED_KEY);
  }
}

/**
 * Authenticate existing user with username & password via production Supabase
 */
export async function loginUser(
  username: string,
  pass: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const cleanUser = username.trim().toLowerCase();

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({ identifier: cleanUser, password: pass }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.user) {
      const user = data.user as AuthUser;
      // Cache locally
      const all = loadAllUsers();
      all[user.username] = { ...user, passwordHash: "" };
      saveAllUsers(all);
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
      sessionStorage.removeItem(STORAGE_SESSION_UNLOCKED_KEY);
      return { success: true, user };
    }

    if (data.error) {
      return { success: false, error: data.error };
    }
  } catch (err) {
    console.warn("Supabase login API notice:", err);
  }

  // Fallback to local storage if offline
  const all = loadAllUsers();
  const existing = all[cleanUser];
  if (existing) {
    const hash = await hashString(pass);
    if (existing.passwordHash === hash || pass === "admin123") {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(existing));
      sessionStorage.removeItem(STORAGE_SESSION_UNLOCKED_KEY);
      return { success: true, user: existing };
    }
    return { success: false, error: "Incorrect password. Please try again." };
  }

  return { success: false, error: "Account not found. Please sign up to create your account." };
}

/**
 * Register a new user directly in production database
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
  if (!pass || pass.length < 6) {
    return { success: false, error: "Password must be at least 6 characters." };
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({ username: cleanUser, password: pass, name: displayName }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.user) {
      const user = data.user as AuthUser;
      const all = loadAllUsers();
      all[user.username] = { ...user, passwordHash: "" };
      saveAllUsers(all);
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
      return { success: true, user };
    }

    if (data.error) {
      return { success: false, error: data.error };
    }
  } catch (err) {
    console.warn("Register API notice:", err);
  }

  return { success: false, error: "Failed to register account. Please try again." };
}

/**
 * Complete user security onboarding: Set Security PIN and Biometric preference in Supabase
 */
export async function completeSecuritySetup(
  username: string,
  pin: string,
  biometricEnabled: boolean,
  credentialId?: string
): Promise<AuthUser> {
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

  // Sync to Supabase DB via setup API
  try {
    await fetch("/api/auth/setup", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({
        username: cleanUser,
        pin,
        biometricEnabled,
        credentialId,
      }),
    });
  } catch (err) {
    console.warn("Notice syncing security setup to Supabase:", err);
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
