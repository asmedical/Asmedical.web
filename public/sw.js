// Service worker ASM — réception des notifications push (Web Push).
// Affiche la notification même quand le site est fermé, et ouvre la
// bonne page au clic.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {}
  const titre = d.titre || "ASM";
  const options = {
    body: d.corps || "",
    icon: "/icone-192.png",
    badge: "/icone-192.png",
    data: { url: d.url || "/messagerie" },
    lang: "fr",
  };
  event.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/messagerie";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
