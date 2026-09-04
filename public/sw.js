/* MarkFlow service worker — web push delivery + notification clicks. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "MarkFlow", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "MarkFlow";
  const options = {
    body: data.body || "",
    tag: data.tag || "markflow",
    renotify: true,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(
    (async () => {
      // If the teacher is actively looking at MarkFlow, don't ping them —
      // the app is already on screen. Only skip when a window is visible.
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (client.visibilityState === "visible" && new URL(client.url).pathname.startsWith("/")) {
          const sameUrl = new URL(client.url).pathname === (options.data.url || "/dashboard");
          if (sameUrl) return; // they're already on it
        }
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch (e) {
              /* ignore */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
