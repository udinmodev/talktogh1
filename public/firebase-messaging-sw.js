const SW_VERSION = "2026-11-09-2";
const FIREBASE_VERSION = "13.1.0";
const FIREBASE_CONFIG_URL = "/api/push/firebase-config";

importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js`);

async function initializeFirebaseMessaging() {
  try {
    const response = await fetch(FIREBASE_CONFIG_URL, { cache: "no-store" });
    const result = await response.json();

    if (!result?.configured || !result.config) {
      console.warn(`[Firebase SW ${SW_VERSION}] Public Firebase config is not configured.`);
      return;
    }

    firebase.initializeApp(result.config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const data = payload.data || {};
      const title = notification.title || "System Sync";
      const body = notification.body || "";

      self.registration.showNotification(title, {
        body,
        data,
        requireInteraction: false,
      });
    });
  } catch (error) {
    console.error(`[Firebase SW ${SW_VERSION}] Initialization failed:`, error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(initializeFirebaseMessaging().then(() => self.skipWaiting()));
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
