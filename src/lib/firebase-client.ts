"use client";

import { getInternalApiHeaders } from "./api-security";

type FirebaseMessaging = import("firebase/messaging").Messaging;
type FirebaseMessagePayload = import("firebase/messaging").MessagePayload;

export type PushRegistrationStatus =
  | "registered"
  | "unsupported"
  | "missing_config"
  | "permission_denied"
  | "token_failed"
  | "registration_failed";

export interface PushRegistrationResult {
  status: PushRegistrationStatus;
  reason?: string;
}

let foregroundHandlerAttached = false;

interface FirebaseWebConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

const REQUIRED_FIREBASE_KEYS = ["apiKey", "projectId", "messagingSenderId", "appId"] as const;

function getEnvFirebaseWebConfig(): FirebaseWebConfig {
  return Object.fromEntries(
    Object.entries({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
    }).filter(([, value]) => Boolean(value))
  );
}

function isCompleteFirebaseWebConfig(config: FirebaseWebConfig | null): config is FirebaseWebConfig {
  return Boolean(
    config &&
      REQUIRED_FIREBASE_KEYS.every((key) => Boolean(config[key]))
  );
}

async function getFirebaseWebConfig(): Promise<FirebaseWebConfig | null> {
  const envConfig = getEnvFirebaseWebConfig();

  try {
    const response = await fetch("/api/push/firebase-config", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { config?: FirebaseWebConfig | null };
      if (data.config) return data.config;
    }
  } catch {
    // Fall back to build-time public environment variables.
  }

  return isCompleteFirebaseWebConfig(envConfig) ? envConfig : null;
}

async function getFirebaseMessaging(config: FirebaseWebConfig): Promise<FirebaseMessaging | null> {
  const [{ initializeApp, getApps, getApp }, { getMessaging, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);

  if (!(await isSupported())) return null;

  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return getMessaging(app);
}

function isValidClientToken(value: string | null): value is string {
  return Boolean(value && value.length > 20 && value.length <= 4096);
}

function detectPlatform(): string {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  return "web";
}

function attachForegroundHandler(messaging: FirebaseMessaging): void {
  if (foregroundHandlerAttached) return;
  foregroundHandlerAttached = true;

  void import("firebase/messaging").then(({ onMessage }) => {
    onMessage(messaging, (payload: FirebaseMessagePayload) => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

      // Dedupe across open tabs: only the first tab to receive the message shows it.
      const messageId = String(payload.data?.messageId || payload.messageId || "");
      if (messageId) {
        try {
          const key = `fcm_notif_${messageId}`;
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, "1");
          window.setTimeout(() => localStorage.removeItem(key), 60000);
        } catch {}
      }

      const title = String(payload.data?.title || payload.notification?.title || "System Sync");
      const body = String(payload.data?.body || payload.notification?.body || "");
      const notification = new Notification(title, {
        body,
        data: payload.data || {},
      });

      notification.onclick = () => {
        window.focus();
        const senderId = payload.data?.senderId;
        if (senderId) {
          window.open(`/${senderId}`, "_self");
        }
      };
    });
  });
}

async function waitForServiceWorker(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active) return;
  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error("Service worker activation timed out.")), 10000)
    ),
  ]);
}

/**
 * Registers the current browser as an FCM device for the signed-in user and
 * stores the token through the server-side push registry.
 */
export async function registerTalkTogetherPush(userId: string): Promise<PushRegistrationResult> {
  if (typeof window === "undefined") {
    return { status: "unsupported", reason: "server" };
  }

  const cleanUserId = String(userId || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);

  if (!cleanUserId || cleanUserId === "user" || cleanUserId === "none") {
    return { status: "unsupported", reason: "invalid_user" };
  }

  if (!window.isSecureContext) {
    return { status: "unsupported", reason: "insecure_context" };
  }

  if (
    !("serviceWorker" in navigator) ||
    !("Notification" in window) ||
    typeof navigator.serviceWorker?.register !== "function"
  ) {
    return { status: "unsupported", reason: "browser" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { status: "permission_denied", reason: permission };
    }

    const firebaseConfig = await getFirebaseWebConfig();
    if (!isCompleteFirebaseWebConfig(firebaseConfig)) {
      return { status: "missing_config", reason: "firebase_web_config" };
    }

    const messaging = await getFirebaseMessaging(firebaseConfig);
    if (!messaging) {
      return { status: "unsupported", reason: "firebase_messaging" };
    }

    attachForegroundHandler(messaging);

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await registration.update().catch(() => undefined);
    await waitForServiceWorker(registration);

    const { getToken } = await import("firebase/messaging");
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      ...(vapidKey ? { vapidKey } : {}),
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { status: "token_failed", reason: "empty_token" };
    }

    // If Firebase rotated this browser's token, remove the stale one so the
    // same device does not receive duplicate notifications.
    const tokenStorageKey = `fcm_token_${cleanUserId}`;
    try {
      const previousToken = localStorage.getItem(tokenStorageKey);
      if (previousToken && previousToken !== token && isValidClientToken(previousToken)) {
        void fetch("/api/push/tokens", {
          method: "DELETE",
          headers: getInternalApiHeaders(),
          body: JSON.stringify({ token: previousToken, userId: cleanUserId }),
        }).catch(() => undefined);
      }
      localStorage.setItem(tokenStorageKey, token);
    } catch {}

    const response = await fetch("/api/push/tokens", {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({
        userId: cleanUserId,
        token,
        platform: detectPlatform(),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      return {
        status: "registration_failed",
        reason: data?.error || `http_${response.status}`,
      };
    }

    console.info("[Push] Device token registered.");
    return { status: "registered" };
  } catch (error) {
    return {
      status: "registration_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
