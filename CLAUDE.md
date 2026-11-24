# Absah — absah-app

School attendance SaaS for Indonesian schools (SD/MI, SMP/MTs, SMA/MA, SMK/MAK). This repo is the
frontend. Full design: docs/architecture.md. Prompt sequence: docs/prompts.md.

## Two repositories (deviation from docs/architecture.md, which assumes one monorepo)
- absah-app (this repo): apps/web, apps/kiosk, packages/{ui, config}.
- absah-api (github.com/rafli21xrplc/absah-api): server, db, and the shared packages
  @absah/contracts (Zod) and @absah/capabilities (catalog + level presets).
- Those two arrive here as git dependencies (github:rafli21xrplc/absah-api#path:/packages/<name>),
  pinned to an absah-api commit in pnpm-lock.yaml. After an absah-api change to them, run
  `pnpm update:shared` and commit the lockfile. Never copy their code into this repo.
- This repo is PUBLIC. Never commit secrets; .env.local is gitignored.

## Stack
- pnpm workspaces + Turborepo, TypeScript 6 strict, ESLint 10 (eslint-config-next + shared rules).
- apps/web: Next.js 16 App Router; route groups (staf) "/", (portal) "/portal", (dudi) "/dudi".
  Portal is a PWA (prompt 3.3). /api/* is rewritten to API_URL (absah-api), so the browser sees one
  origin: Better Auth cookies work without CORS.
- apps/kiosk: Next.js static export (output: 'export'), offline-first with an IndexedDB queue
  (prompt 3.1). No rewrites in static export: calls NEXT_PUBLIC_API_URL.
- packages/ui: design system (tokens.css, components). packages/config: tsconfig, eslint.

## Commands
- pnpm dev                        web :3000 + kiosk :3001 (needs absah-api on API_URL)
- pnpm turbo lint typecheck test  must pass before you say a task is done
- pnpm build
- pnpm update:shared              pull the latest @absah/contracts and @absah/capabilities

## Rules
1. Never branch on school level (no if level === 'sd'). Read capabilities from GET /api/v1/me/context
   and hide menus with useCapability(key) / <IfCap name="..."> (prompt 1.4). The server enforces
   the same rules with requireCap; hiding is not security.
2. Validate API responses with the Zod contract from @absah/contracts (lib/api.ts apiGet).
   Branch on error `code`, never on message text.
3. Write requests send an Idempotency-Key (kiosk, PKL check-in and payments always).
4. No personal data in client logs, analytics or URLs (no names, phone numbers, NISN in query strings).
5. No any, no ts-ignore, no disabled tests to make CI green. If blocked, stop and explain.
6. Dates shown in the school timezone from the context, not the device timezone.

## UI
- Copy is Indonesian, short and plain ("Semua hadir kecuali…"). One decision per screen.
- Works on cheap Android phones: small bundles, no heavy animation, large text and 44px tap targets.
- Colors only through tokens in @absah/ui/tokens.css (light + dark).

## Session and workspace in the web
- Staff pages live in app/(staf) under <WorkspaceProvider> (lib/workspace.tsx): it loads /me/context,
  remembers the chosen school (localStorage, best effort), redirects to /masuk without a session and
  to /keamanan/dua-langkah on TWO_FACTOR_REQUIRED. Account pages (masuk, undangan, keamanan) are in
  app/(akun) and need no workspace.
- Call the API with api(path, Contract, { method, body, schoolId, idempotencyKey }) from lib/api.ts.
  Create one idempotency key per user action (newIdempotencyKey) and reuse it when retrying.
- Better Auth endpoints go through lib/auth.ts. Invitation tokens are read from the #fragment, removed
  from the address bar, and sent only in POST bodies.

## End-to-end tests (Playwright, apps/web/e2e)
- `pnpm --filter @absah/web e2e` starts absah-api from ../absah-api (or E2E_API_DIR) on port 4710 and
  Next on 3710 against E2E_DATABASE_URL (default: local absah_test). Schools are created with the
  API's `school:create` CLI. Never point E2E_DATABASE_URL at a shared database.
- Specs cannot import @absah/* source (Playwright does not transpile node_modules): check through the API.
- CI job e2e checks out absah-api at the commit pinned in apps/web/package.json.

## Student data pages (apps/web/app/(staf)/siswa, rombel, import)
- Role gates mirror the API (lib/student-access.ts): readers admin/operator/kepsek/wakasek,
  managers admin/operator; useWorkspace().hasRole(...). The API remains the authority.
- Import: POST /imports/dapodik -> fetch PUT to upload.url with upload.headers exactly -> POST
  /parse -> poll GET /imports/{id} -> preview -> POST /commit with one Idempotency-Key per click
  (reused on retry). 409 details.reason = stale_preview -> offer "Muat ulang pratinjau" (POST /parse).
- E2E runs absah-api http + worker (concurrently); fixtures come from absah-api packages/db/fixtures.

## Capabilities in the web
- Never branch on the school level. Read capabilities from /me/context (active.capabilities) through
  <CapabilitiesProvider> (apps/web/lib/capabilities.tsx); use useCapability(key) for enums and
  <IfCap name="bool.key"> to hide menus and screens. Hiding is cosmetic; the API enforces requireCap.

## Working style
- Before writing code, post a short plan: files to add/change, endpoints used, tests.
- Keep PRs under ~600 changed lines excluding generated files; split otherwise.
- When a requirement is ambiguous, check docs/architecture.md first, then ask.
- Code, comments, commits in English.

## Glossary
rombel = class group; wali kelas = homeroom teacher; guru mapel = subject teacher;
piket = duty teacher; S/I/A = sakit/izin/alpa, H = hadir, T = terlambat; izin = leave request;
TPPK = school anti-violence team; UKS = school clinic; PKL = industry internship (SMK);
DUDI = industry partner; 7 KAIH = seven habits journal; MBG = free school meal program.
