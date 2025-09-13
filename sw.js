//v19b

const CACHE_NAME = 'raffleiq-admin-v1';

// Install event - minimal caching to avoid errors
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Only cache the current page, no other resources
        return cache.add(self.location.href).catch(() => {
          // If even this fails, continue anyway
          return Promise.resolve();
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle API requests with network-first strategy
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone the response because it can only be used once
          const responseClone = response.clone();
          
          // Cache successful API responses
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Handle static resources with cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not successful
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Add to cache
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New raffle activity!',
    icon: 'data:image/svg+xml,%3csvg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"%3e%3crect width="192" height="192" fill="%234F46E5"/%3e%3ctext x="96" y="96" font-size="120" text-anchor="middle" dominant-baseline="middle" fill="white"%3e🎫%3c/text%3e%3c/svg%3e',
    badge: 'data:image/svg+xml,%3csvg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"%3e%3crect width="72" height="72" fill="%23EF4444"/%3e%3ctext x="36" y="36" font-size="45" text-anchor="middle" dominant-baseline="middle" fill="white"%3e!%3c/text%3e%3c/svg%3e',
    vibrate: [200, 100, 200],
    tag: 'raffle-update',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: 'data:image/svg+xml,%3csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"%3e%3cpath d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/%3e%3ccircle cx="12" cy="12" r="3"/%3e%3c/svg%3e'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: 'data:image/svg+xml,%3csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"%3e%3cline x1="18" y1="6" x2="6" y2="18"/%3e%3cline x1="6" y1="6" x2="18" y2="18"/%3e%3c/svg%3e'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('RaffleIQ Admin', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/admin-monitor.html')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('/admin-monitor.html');
        }
      })
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'raffle-action') {
    event.waitUntil(
      // Handle offline actions when connection is restored
      processOfflineActions()
    );
  }
});

async function processOfflineActions() {
  // Retrieve queued actions from IndexedDB or localStorage
  // and execute them when online
  
  try {
    const actions = await getQueuedActions();
    
    for (const action of actions) {
      try {
        await fetch(`/api/admin/raffles/${action.raffleId}/${action.type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.params || {})
        });
        
        // Remove from queue on success
        await removeQueuedAction(action.id);
      } catch (error) {
        console.error('Failed to process offline action:', error);
        // Keep in queue for next sync
      }
    }
  } catch (error) {
    console.error('Failed to process offline actions:', error);
  }
}

// Placeholder functions - implement with IndexedDB for robust offline storage
async function getQueuedActions() {
  // Return array of queued actions
  return [];
}

async function removeQueuedAction(actionId) {
  // Remove action from queue
  return;
}