// Portal service worker (PWA siswa, ORT-02). Only portal pages, the action link page, the phone
// login and static assets are handled: network first, the cache when offline, so the installed app
// opens without signal and shows the card from the keys kept on the phone. /api is never cached
// (personal data stays out of the cache); staff pages pass through untouched.
// Staff session screens (PRS-08): the page shells of /hari-ini and /sesi/<id> are kept too (navigations only, plus the
// warm-up requests /hari-ini sends with x-absah-warm), so a teacher without signal can open the session and fill it; the
// roster itself comes from IndexedDB, never from this cache. Everything else of staff stays uncached.
// The same worker also shows staff Web Push (NTF-06): an origin has ONE worker per scope, and a second
// script at "/" would replace this one, so push lives here. Parents never subscribe, so for them the
// push handlers simply never fire.
const CACHE = 'absah-portal-v2';
const SHELL = ['/portal', '/masuk/hp'];
const STAFF_SHELLS = [/^\/hari-ini$/, /^\/sesi\/[^/]+$/];
const HANDLED = [/^\/portal(\/|$)/, /^\/t$/, /^\/masuk\/hp$/, /^\/_next\/static\//, /^\/icons\//, /^\/manifest\.webmanifest$/];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('absah-portal-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const staffShell = STAFF_SHELLS.some((re) => re.test(url.pathname)) && (event.request.mode === 'navigate' || event.request.headers.get('x-absah-warm') === '1');
  if (!staffShell && !HANDLED.some((re) => re.test(url.pathname))) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(event.request, { ignoreSearch: true }).then((hit) => hit ?? (event.request.mode === 'navigate' ? caches.match('/portal') : undefined) ?? Response.error()),
      ),
  );
});

/** A path of this app only: a push can never send the user to another site. */
const safePath = (value) => (typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : '/');

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Absah';
  const tag = typeof data.tag === 'string' && data.tag ? data.tag : undefined;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag,
      // A newer message with the same tag replaces the old one; ring again so it is noticed.
      renotify: tag !== undefined,
      data: { url: safePath(data.url) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open && 'focus' in open) return open.focus().then((w) => (w && 'navigate' in w ? w.navigate(target) : undefined));
      return self.clients.openWindow(target);
    }),
  );
});
