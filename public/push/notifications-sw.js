self.addEventListener("push", event => {
  let data = { title: "Gerenciamento de Empréstimos", body: "Você tem um novo aviso.", path: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, tag: data.tag || "overdue", icon: "/pwa-192x192.png", badge: "/pwa-192x192.png", data: { path: data.path } }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.path || "/", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === url.origin);
    if (existing) { await existing.navigate(url.href); await existing.focus(); }
    else await self.clients.openWindow(url.href);
  })());
});