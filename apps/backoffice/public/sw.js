/**
 * Service worker de la PWA : réception des Web Push et ouverture de l'app
 * au clic sur la notification. Pas de cache offline : le backoffice est
 * une app de données vivantes, on reste toujours sur le réseau.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Back Office", {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { path: payload.path ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        // Une fenêtre de l'app est déjà ouverte : on la focus et on navigue.
        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            client.focus();
            if ("navigate" in client) return client.navigate(path);
            return;
          }
        }
        return self.clients.openWindow(path);
      })
  );
});
