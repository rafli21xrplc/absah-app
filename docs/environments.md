# Lingkungan dan variabel — absah-app

Lokal: salin `apps/web/.env.example` dan `apps/kiosk/.env.example` menjadi `.env.local` (gitignored).
Repo ini publik; nilai rahasia tidak pernah di-commit. Frontend tidak menyimpan rahasia sama sekali.
Variabel `NEXT_PUBLIC_*` ikut ke browser.

| Variabel | App | dev | preview | staging | production |
| --- | --- | --- | --- | --- | --- |
| `API_URL` | web (rewrite `/api/*`, server-side) | `http://localhost:4000` | URL API preview | URL API staging | URL API production |
| `NEXT_PUBLIC_API_URL` | kiosk (static export) | `http://localhost:4000` | URL API preview | `https://<staging>/` | `https://<produksi>/` |

Kios disarankan disajikan dari domain yang sama dengan API di belakang Cloudflare (mis. `/kiosk`),
supaya tidak perlu CORS. Bila domainnya berbeda, absah-api perlu daftar origin yang diizinkan (Fase 3).

Variabel absah-api (database, R2, WhatsApp) ada di `docs/environments.md` milik repo absah-api.
