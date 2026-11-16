// Portal service worker (PWA siswa, ORT-02). Only portal pages, the action link page, the phone
// login and static assets are handled: network first, the cache when offline, so the installed app
// opens without signal and shows the card from the keys kept on the phone. /api is never cached
// (personal data stays out of the cache); staff pages pass through untouched.
const CACHE = 'absah-portal-v1';
const SHELL = ['/portal', '/masuk/hp'];
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
  if (!HANDLED.some((re) => re.test(url.pathname))) return;
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
