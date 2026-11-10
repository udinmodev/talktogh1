const SW_VERSION = "2026-11-09-4";
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

// Firebase requires messaging handlers to be registered synchronously during
// the initial evaluation of the worker script.
try {
  firebase.initializeApp(FIREBASE_CONFIG);
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
