/*
 * Service Worker for Zmzir Web Push Notifications
 * Handles background push events, call notifications, and deep-link navigation.
 */

// Install: take control immediately to avoid stale worker delays
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: claim all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Push event: display notification with type-aware options
self.addEventListener('push', (event) => {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // If not JSON, try text
    data = { title: event.data ? event.data.text() : 'New Notification' };
  }

  const isCall = data.type === 'call' || data.type === 'incoming_call';
  const title = data.title || (isCall ? '📞 Incoming Call' : 'New Notification');
  const body = data.body || data.message || '';
  const spaceId = data.data?.spaceId || data.spaceId;

  const notificationOptions = {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: {
      type: data.type,
      spaceId,
      postId: data.data?.postId || data.postId,
      userId: data.data?.userId || data.userId,
      url: isCall && spaceId
        ? `/(spaces)/${spaceId}?tab=meeting`
        : (spaceId ? `/(spaces)/${spaceId}` : '/'),
    },
    // Call notifications: require explicit interaction and vibrate
    ...(isCall ? {
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500],
      tag: `call-${spaceId}`,   // deduplicate: one popup per call
      renotify: true,
      actions: [
        { action: 'accept', title: '✅ Accept' },
        { action: 'decline', title: '❌ Decline' },
      ],
    } : {
      vibrate: [200, 100, 200],
      tag: `notif-${Date.now()}`,
    }),
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// Notification click: deep-link to the correct route
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';
  const action = event.action;

  // Handle call action buttons
  if (action === 'decline') {
    // Just close — the call will timeout on the caller's end
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing open window
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          // Navigate to the correct route
          if ('navigate' in client) {
            client.navigate(targetUrl);
          } else {
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          }
          return;
        }
      }
      // No window open — open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
