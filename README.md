# absah-app

Frontend Absah: web staf, portal orang tua/siswa, portal pembimbing industri (Next.js 16), dan kios
gerbang offline. Backend ada di [absah-api](https://github.com/rafli21xrplc/absah-api).

- Arsitektur: [docs/architecture.md](docs/architecture.md)
- Urutan prompt pengembangan: [docs/prompts.md](docs/prompts.md)
- Lingkungan: [docs/environments.md](docs/environments.md)
- Aturan untuk Claude Code dan kontributor: [CLAUDE.md](CLAUDE.md)

## Mulai

```bash
fnm use && corepack enable && pnpm install
cp apps/web/.env.example apps/web/.env.local
cp apps/kiosk/.env.example apps/kiosk/.env.local
pnpm dev     # web :3000, kios :3001; jalankan absah-api di :4000
pnpm turbo lint typecheck test
```

| Paket | Isi |
| --- | --- |
| `apps/web` | route group `(staf)` `/`, `(portal)` `/portal`, `(dudi)` `/dudi` |
| `apps/kiosk` | Next.js static export untuk perangkat gerbang |
| `packages/ui` | token desain dan komponen |
| `@absah/contracts`, `@absah/capabilities` | diambil dari absah-api lewat git (lihat CLAUDE.md) |
