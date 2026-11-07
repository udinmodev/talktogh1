"use client";

import { useState, useEffect, useCallback } from "react";
import { SecuritySettings, DEFAULT_SETTINGS } from "@/types/chat";
import { chatSync } from "@/lib/broadcast";
import { getInternalApiHeaders } from "@/lib/api-security";

export function useChatSettings(cleanCurrentId: string) {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);

  // Load saved preferences from cloud database (with offline local cache)
  useEffect(() => {
    if (!cleanCurrentId || cleanCurrentId === "user") return;

    try {
      const saved = localStorage.getItem(`wechat_settings_${cleanCurrentId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed.appLockPin;
        delete parsed.pin;
        delete parsed.correctPin;
        delete parsed.lockPin;

        if (parsed.disappearingTimer === 30 && !localStorage.getItem(`wechat_dtimer_explicit_${cleanCurrentId}`)) {
          parsed.disappearingTimer = 0;
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
        localStorage.setItem(`wechat_settings_${cleanCurrentId}`, JSON.stringify(parsed));
      }
    } catch {}

    fetch(`/api/settings?userId=${encodeURIComponent(cleanCurrentId)}`, {
      headers: getInternalApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.settings) {
          const s = data.settings;
          delete s.appLockPin;
          delete s.pin;
          delete s.correctPin;
          delete s.lockPin;

          if (s.disappearingTimer === 30 && !localStorage.getItem(`wechat_dtimer_explicit_${cleanCurrentId}`)) {
            s.disappearingTimer = 0;
          }
          setSettings((prev) => ({ ...prev, ...s }));
          try {
            localStorage.setItem(`wechat_settings_${cleanCurrentId}`, JSON.stringify(s));
          } catch {}
        }
      })
      .catch((err) => console.warn("Cloud settings fetch notice:", err));
  }, [cleanCurrentId]);

  const handleUpdateSettings = useCallback(
    (newOpts: Partial<SecuritySettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newOpts };
        delete (updated as any).appLockPin;
        delete (updated as any).pin;
        delete (updated as any).correctPin;
        delete (updated as any).lockPin;

        if (newOpts.disappearingTimer !== undefined) {
          try {
            localStorage.setItem(`wechat_dtimer_explicit_${cleanCurrentId}`, "true");
          } catch {}
        }

        try {
          localStorage.setItem(`wechat_settings_${cleanCurrentId}`, JSON.stringify(updated));
        } catch {}

        if (cleanCurrentId && cleanCurrentId !== "user") {
          fetch("/api/settings", {
            method: "POST",
            headers: getInternalApiHeaders(),
            body: JSON.stringify({ userId: cleanCurrentId, settings: updated }),
          }).catch((err) => console.warn("Cloud settings persist notice:", err));

          chatSync.broadcast({
            type: "SAVE_SETTINGS",
            userId: cleanCurrentId,
            settings: updated,
          });
        }

        return updated;
      });
    },
    [cleanCurrentId]
  );

  // Privacy Curtain & App Concealment on Blur / Tab Switch
  useEffect(() => {
    const handleBlur = () => {
      if (settings.privacyCurtain) setIsWindowBlurred(true);
    };
    const handleFocus = () => setIsWindowBlurred(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (settings.privacyCurtain) setIsWindowBlurred(true);
      } else if (document.visibilityState === "visible") {
        setIsWindowBlurred(false);
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [settings.privacyCurtain]);

  return {
    settings,
    setSettings,
    handleUpdateSettings,
    isWindowBlurred,
  };
}
