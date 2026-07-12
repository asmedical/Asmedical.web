// Service worker ASM — notifications push + secours hors-ligne.
// 1. Push : affiche la notification même app fermée, ouvre la bonne page.
// 2. Hors-ligne : les pages passent toujours par le réseau (données à jour) ;
//    si le réseau est coupé, une page de secours s'affiche au lieu de
//    l'erreur du navigateur.

const CACHE = "asm-v1";
const SECOURS = "/hors-ligne";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([SECOURS, "/icone-192.png", "/logo-asm.jpg"])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
);

// Réseau d'abord (jamais de données périmées) ; page de secours si coupure.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(SECOURS)));
  }
});

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
