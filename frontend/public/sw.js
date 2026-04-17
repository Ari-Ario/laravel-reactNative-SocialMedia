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
  event.waitUntil(async function() {
    let data = {};
    if (event.data) {
      try {
        data = event.data.json();
      } catch (e) {
        data = { title: event.data.text() };
      }
    }

    // Robust Payload Extraction
    const payload = data.data || data;
    const type = payload.type || data.type || 'default';
    const isCall = type === 'call' || type === 'incoming_call';
    
    // 🔍 FOREGROUND CHECK: Detect if any app window is currently focused.
    // If focused, we skip the system notification to allow the internal React 
    // UI (Modal/Toast) to handle the alert without duplication.
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const isAppFocused = windowClients.some(client => client.focused);

    if (isAppFocused) {
      console.log('🔇 App focused: Suppressing system notification for type:', type);
      return;
    }

    const title = data.title || payload.title || (isCall ? '📞 Incoming Call' : 'New Notification');
    const body = data.body || data.message || payload.body || payload.message || '';
    const spaceId = payload.spaceId || data.spaceId;
    const callId = payload.callId || data.callId;

    const tag = isCall ? `call-${spaceId || 'global'}` : (payload.id || `notif-${Date.now()}`);

    const callerName = payload.callerName || data.userName || (isCall ? 'Someone' : '');
    const callType = payload.callType || data.type || 'video';
    const spaceType = payload.spaceType || data.spaceType || 'group';

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
          ? `/(spaces)/${spaceId}?ringing=1&call=${callId || ''}&callerName=${encodeURIComponent(callerName)}&callType=${callType}&spaceType=${spaceType}`
          : (spaceId ? `/(spaces)/${spaceId}` : '/'),
      },

      // Interactive actions
      actions: isCall ? [
        { action: 'accept', title: '✅ Accept' },
        { action: 'decline', title: '❌ Decline' },
      ] : [],
      requireInteraction: isCall,
      vibration: isCall ? [500, 200, 500, 200, 500] : [200, 100],
    };

    return self.registration.showNotification(title, notificationOptions);
  }());
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
