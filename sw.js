const CACHE_NAME = "kaiya-memo-v16";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // Firebase SDKのキャッシュも追加
  "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js"
];

// インストール時：必要なファイルをキャッシュ
self.addEventListener("install", (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching files');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener("activate", (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// フェッチ時：キャッシュファーストで応答
self.addEventListener("fetch", (event) => {
  // Firebase関連のリクエストはネットワークファーストで処理
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebase')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // ネットワークエラー時はキャッシュから返す（可能なら）
          return caches.match(event.request);
        })
    );
    return;
  }

  // その他のリクエストはキャッシュファーストで処理
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        // キャッシュにない場合はネットワークから取得
        return fetch(event.request)
          .then(response => {
            // レスポンスが有効でない場合はそのまま返す
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 重要なファイルのみキャッシュに保存
            if (event.request.url.includes('.html') || 
                event.request.url.includes('.css') || 
                event.request.url.includes('.js') ||
                event.request.url.includes('.png') ||
                event.request.url.includes('.jpg')) {
              
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }

            return response;
          })
          .catch(() => {
            // ネットワークエラー時はオフラインページを表示（必要に応じて）
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// プッシュ通知対応（将来の拡張用）
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || '新しいメモが追加されました',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: data.url || './'
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'カイヤメモ帳', options)
    );
  }
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click');
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data || './')
  );
});
