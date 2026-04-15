/*
 * Service Worker for Zmzir Web Push Notifications
 * Handles background push events, call notifications, and deep-link navigation.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: event.data.text() };
    }
  }

  const payload = data.data || data;
  const type = payload.type || data.type || 'default';
  const isCall = type === 'call' || type === 'incoming_call';
  
  const title = data.title || payload.title || (isCall ? '📞 Incoming Call' : 'New Notification');
  const body = data.body || data.message || payload.body || payload.message || '';
  const spaceId = payload.spaceId || data.spaceId;
  const callId = payload.callId || data.callId;

  const tag = isCall ? `call-${spaceId || 'global'}` : (payload.id || `notif-${Date.now()}`);

  const notificationOptions = {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag,
    renotify: true,
    data: {
      type,
      spaceId,
      callId,
      postId: payload.postId || data.postId,
      userId: payload.userId || data.userId,
      url: isCall && spaceId
        ? `/(spaces)/${spaceId}?tab=meeting&joining=1&call=${callId || ''}`
        : (spaceId ? `/(spaces)/${spaceId}` : '/'),
    },
    actions: isCall ? [
      { action: 'accept', title: '✅ Accept' },
      { action: 'decline', title: '❌ Decline' },
    ] : [],
    requireInteraction: isCall,
    vibration: isCall ? [500, 200, 500, 200, 500] : [200, 100],
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';
  const action = event.action;

  if (action === 'decline') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          } else {
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
