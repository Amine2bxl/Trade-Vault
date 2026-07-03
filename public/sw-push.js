// Dedicated Web Push service worker. Messaging-only — separate from any
// app-shell SW. Scope is "/" so notification clicks can focus any page.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {
    title: 'TradeVault',
    body: 'You have a new notification',
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    url: '/',
  };
  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (_) {
    try { if (event.data) data.body = event.data.text(); } catch (_) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: 'tradevault-notification',
      renotify: true,
      requireInteraction: false,
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.includes(self.location.origin) && 'focus' in client) {
        try { await client.navigate(urlToOpen); } catch (_) {}
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
  })());
});