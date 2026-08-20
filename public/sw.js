// public/sw.js
//
// Deze service worker draait los van de React-app, ook als de gebruiker de
// app niet open heeft staan. Hij vangt inkomende pushmeldingen op en toont
// een notificatie, en handelt een klik daarop af door de app te openen.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Vogel gespot!', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Vogel gespot in de buurt!';
  const options = {
    body: data.body || '',
    icon: '/bird-icon-192.png',
    badge: '/bird-icon-192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});