const SW_VERSION = "2026-11-10-3";
const FIREBASE_VERSION = "13.1.0";

importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js`);

// Public Firebase Web App config (safe to expose; never contains service-account secrets).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA2sqmltAmVWJf6OdLqvMP1HKN3JK0Tjdc",
  authDomain: "outlaw-redemption.firebaseapp.com",
  projectId: "outlaw-redemption",
  storageBucket: "outlaw-redemption.firebasestorage.app",
  messagingSenderId: "109237196913",
  appId: "1:109237196913:web:9312d82a9b4bb6902363d0",
};

// In-worker dedupe to guarantee zero double notifications within 60s window
const seenNotificationIds = new Map();
function isDuplicateNotification(id) {
  if (!id) return false;
  const now = Date.now();
  for (const [k, time] of seenNotificationIds.entries()) {
    if (now - time > 60000) seenNotificationIds.delete(k);
  }
  if (seenNotificationIds.has(id)) return true;
  seenNotificationIds.set(id, now);
  return false;
}

// Firebase requires messaging handlers to be registered synchronously during
// the initial evaluation of the worker script.
try {
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    // If the message has a top-level notification, Firebase SDK automatically
    // displays it. Calling showNotification again would cause duplicate notifications.
    if (payload.notification && (payload.notification.title || payload.notification.body)) {
      return;
    }

    const data = payload.data || {};
    const messageId = data.messageId || "";
    if (messageId && isDuplicateNotification(messageId)) {
      return;
    }

    const title = data.title || "System Sync";
    const body = data.body || "";
    const tag = messageId ? `notif_${messageId}` : "talk_together_sync";

    self.registration.showNotification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag,
      renotify: false,
      data,
      requireInteraction: false,
    });
  });
} catch (error) {
  console.error(`[Firebase SW ${SW_VERSION}] Initialization failed:`, error);
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const senderId = event.notification.data?.senderId;
  const targetUrl = senderId ? `/${senderId}` : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
