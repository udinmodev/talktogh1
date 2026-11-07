"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getCurrentAuthUser,
  isSessionUnlocked,
  setSessionUnlocked,
  logoutUser,
  AuthUser,
} from "@/lib/auth";
import { SecuritySettings } from "@/types/chat";

interface UseChatAuthProps {
  settings: SecuritySettings;
  onSettingsUpdate: (opts: Partial<SecuritySettings>) => void;
  onClearSelectedContact: () => void;
}

export function useChatAuth({ settings, onSettingsUpdate, onClearSelectedContact }: UseChatAuthProps) {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const user = getCurrentAuthUser();
      if (!user || !user.isSecuritySetupComplete) return false;
      return !isSessionUnlocked(user.username);
    } catch {
      return false;
    }
  });

  const cleanCurrentId = (authUser ? authUser.username : (currentUserId || "user")).split("@")[0].toLowerCase();

  // Load auth state on client mount (isolated per browser tab via sessionStorage)
  useEffect(() => {
    const user = getCurrentAuthUser();
    setAuthUser(user);
    if (user) {
      setCurrentUserId(user.username);
      if (user.isSecuritySetupComplete) {
        setIsAppLocked(!isSessionUnlocked(user.username));
      } else {
        setIsAppLocked(false);
      }
    }
    setIsAuthLoaded(true);
  }, []);

  const handleLoginSuccess = useCallback((user: AuthUser) => {
    setAuthUser(user);
    setCurrentUserId(user.username);
    setSessionUnlocked(true, user.username);
    setIsAppLocked(false);
  }, []);

  const handleSecuritySetupComplete = useCallback((updatedUser: AuthUser) => {
    setAuthUser(updatedUser);
    setSessionUnlocked(true, updatedUser.username);
    setIsAppLocked(false);
    onSettingsUpdate({ appLockPinHash: updatedUser.pinHash });
  }, [onSettingsUpdate]);

  const handleLogout = useCallback(() => {
    logoutUser(cleanCurrentId);
    setAuthUser(null);
    setIsAppLocked(false);
    onClearSelectedContact();
    router.push("/");
  }, [cleanCurrentId, onClearSelectedContact, router]);

  // Inactivity Auto-Lock & Session Integrity Safeguard
  useEffect(() => {
    const isLockConfigured = Boolean(authUser?.hasPin || settings.appLockEnabled || settings.appLockPinHash);
    if (!isLockConfigured || isAppLocked) return;

    let inactivityTimeout: NodeJS.Timeout;
    const lockTimeMs = (settings.inactivityLockSeconds || 60) * 1000;

    const resetTimer = () => {
      clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        setSessionUnlocked(false);
        setIsAppLocked(true);
      }, lockTimeMs);
    };

    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll", "pointerdown"];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(inactivityTimeout);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [authUser?.hasPin, settings.appLockEnabled, settings.appLockPinHash, settings.inactivityLockSeconds, isAppLocked]);

  return {
    authUser,
    setAuthUser,
    isAuthLoaded,
    currentUserId,
    setCurrentUserId,
    cleanCurrentId,
    isAppLocked,
    setIsAppLocked,
    handleLoginSuccess,
    handleSecuritySetupComplete,
    handleLogout,
  };
}
