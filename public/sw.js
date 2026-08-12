// Noi service worker — handles Web Push events + notification clicks.
//
// Kept intentionally minimal: no caching / offline strategy yet (that's
// a follow-up). Registers, listens for push events, shows the OS
// notification, and routes taps to the URL in the payload.
//
// iOS: Web Push only works when the site is installed to home screen
// as a PWA (Add to Home Screen from Safari). Notifications will
// silently no-op in a regular Safari tab.

const NOI_TAG = "noi-notification";

self.addEventListener("install", (event) => {
  // Take control on first install — no waiting for tabs to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Some push services deliver plain text — fall back to a generic.
    payload = { title: "Noi", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Noi";
  const body = payload.body || "";
  const url = payload.url || "/";
  const tag = payload.tag || NOI_TAG;

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag,
    // renotify=true so a second push with the same tag still buzzes;
    // otherwise iOS silently coalesces them.
    renotify: true,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If Noi is already open somewhere, focus that window and route it.
      for (const client of allClients) {
        const clientUrl = new URL(client.url);
        // Any Noi tab — focus it and post-message the desired URL so
        // the app can navigate without a full reload.
        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              return client.navigate(targetUrl);
            } catch {
              // Some browsers restrict cross-origin navigate; fall
              // through to open a new window.
            }
          }
          return;
        }
      }

      // No existing Noi window — open one.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
