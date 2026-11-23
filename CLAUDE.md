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
- The kiosk runs in e2e as it ships: `next build` (static export, NEXT_PUBLIC_API_URL = the e2e API)
  served by e2e/static-server.ts on 3711 (KIOSK_ORIGINS on the API). Kiosk specs use their own
  browser context with serviceWorkers: 'block' (so page.route sees API calls) and page.clock.
  Card tokens come from helpers.cardToken with keys from absah-api `gate:load-fixture` (dev only).

## Student data pages (apps/web/app/(staf)/siswa, rombel, import)
- Role gates mirror the API (lib/student-access.ts): readers admin/operator/kepsek/wakasek,
  managers admin/operator; useWorkspace().hasRole(...). The API remains the authority.
- Import: POST /imports/dapodik -> fetch PUT to upload.url with upload.headers exactly -> POST
  /parse -> poll GET /imports/{id} -> preview -> POST /commit with one Idempotency-Key per click
  (reused on retry). 409 details.reason = stale_preview -> offer "Muat ulang pratinjau" (POST /parse).
- E2E runs absah-api http + worker (concurrently); fixtures come from absah-api packages/db/fixtures.
- The page follows data.source: dapodik -> POST /imports/dapodik, emis (madrasah, AKD-09) -> POST
  /imports/emis; same upload/parse/preview/commit, only the wording differs (SOURCES in import/page.tsx).

## Schedule page (apps/web/app/(staf)/jadwal)
- Tabs: Jadwal pelajaran (grid per rombel: days across, jam ke-n down; PUT /schedule/slots,
  409 SCHEDULE_CONFLICT -> details.conflicts rendered with conflictText), Jam pelajaran (PUT
  /schedule/periods replaces all days), Wali kelas (PATCH /classes/{id}), Import Excel (template
  download with X-School-Id via fetch+blob, presigned upload, POST preview, POST commit with the
  preview fingerprint; stale_preview -> re-run preview).
- Roles (lib/schedule-access.ts): page for admin/operator/kepsek/wakasek (it lists rombel);
  editing for admin/operator/wakasek. attendance.mode = 'daily' opens on Wali kelas; the grid is optional.

- Kelompok belajar (AKD-10, tab when attendance.learningGroups): GET /learning-groups, POST to create
  (name, mapel, guru), GET /learning-groups/{id} + PUT .../members (whole list; students picked per rombel
  from GET /students?classId; 409 SCHEDULE_CONFLICT -> conflictText). The grid's owner select also lists
  groups (value "class:<id>" | "group:<id>"), so group lessons are set like rombel lessons.

## Jam siswa and jurusan (AKD-10, AKD-11)
- /jam-siswa (menu for RECAP_READERS when attendance.mode = per_period): rombel from the rekap list (the API
  narrows a wali kelas to their own), date (default today, school timezone), GET
  /classes/{id}/student-hours: one column per session incl. learning groups ("—" = not the student's).
- /rekap: "Jurusan" select when any rombel has a stream (lib/report.ts streamsOf, STREAM_LABELS); the list
  is filtered client side and ExportButtons sends the same stream (whole-year export only).
- ExportButtons labels RDM "(uji coba)"; 409 release_flag_off shows the API's message.

## Attendance pages (apps/web/app/(staf)/hari-ini, sesi/[id], koreksi)
- Hari ini: GET /attendance/today?scope=mine|all (all for admin/operator/kepsek/wakasek/piket).
- Session screen is built for one thumb: every student starts Hadir, five 44px choices per row,
  fixed rows (izin, UKS, koreksi) shown read-only, a fixed send bar at the bottom. Submit sends
  exceptions only, one Idempotency-Key per send (reused on retry, reset when an answer changes).
- Locked sessions: "Ajukan koreksi" picks changes + reason -> POST /sessions/{id}/corrections.
  /koreksi: wakasek and kepsek approve or reject; others see their own requests.
- E2E creates today's sessions with absah-api `attendance:generate --force` (helpers.generateSessions).

## Izin pages (apps/web/app/(staf)/izin, izin/baru)
- /izin lists GET /leave-requests?status=pending|all (the API limits what each user sees); staff
  (guru, wali_kelas, wakasek, kepsek) get Setujui/Tolak on pending requests by others; requester or
  decider can "Batalkan izin". Attachments open through GET /leave-requests/{id}/attachment (a
  5-minute link, opened in a new tab; never put the link in our own URLs).
- /izin/baru: students from GET /leave-requests/students, Sakit/Izin, dates (default today in the
  school timezone, lib/leave.ts todayIn), reason, optional photo/PDF (presign -> PUT -> id).
  Entered by the wali kelas = approved at once; the session screen shows the student fixed.
- Parents ask izin through action links (/t, prompt 3.3); the full parent portal is prompt 5.7.

## Gate pages (apps/web/app/(staf)/gerbang, gerbang/kios)
- Menu "Gerbang" for GATE_VIEWERS (lib/gate.ts) when gate.enabled. /gerbang: GET /gate/today
  (counts, late list, not-arrived list with approved izin flagged); "Catat datang" (ARRIVAL_RECORDERS)
  posts /gate/arrivals with a required reason, one Idempotency-Key per form.
- /gerbang/kios (admin, operator): "Buat kode pasang" shows the one-time code as QR (qrcode) and
  text; list of kiosks with online/offline, last heartbeat, queue size and version, refreshed every
  30 s; "Cabut" revokes after a confirm.

## Notifications page (apps/web/app/(staf)/notifikasi)
- Menu "Notifikasi WhatsApp" for NOTIFY_VIEWERS (admin, operator; lib/notify.ts). GET
  /notifications/overview: today's counts per status, failures of the last 7 days with the masked
  number, first name, attempts and a plain-words reason (errorLabel; the raw code stays visible).
- Never show or log full phone numbers; the API already masks them.

## MBG page (apps/web/app/(staf)/mbg, RKP-08)
- Home card "MBG hari ini" (MbgCard) and /mbg for MBG_READERS (admin, operator, kepsek, wakasek;
  lib/mbg.ts) when mbg.enabled. GET /mbg/daily: pending = live numbers until the cutoff, counted =
  what the PIC received (rows marked "dikoreksi" after a correction), not_school_day.
- "Prakiraan porsi (H-3)" (mbg/forecast.tsx, RKP-09): GET /mbg/forecast?date (default today + 3):
  computed per rombel (siswa, izin, di luar sekolah, porsi) or pending (job at 13.00, school days only).
- Admin only: "Hitung ulang dan kirim koreksi" (POST /mbg/daily/recount, counted days) and the
  settings form (PUT /mbg/settings: cutoff, PIC name; an empty number field keeps the stored number,
  "hapus" sends null). Numbers are shown masked only.

## Billing page (apps/web/app/(staf)/tagihan, BIL)
- Menu "Tagihan Absah" for BILLING_READERS (admin, kepsek; lib/billing.ts). /tagihan lists GET
  /billing/invoices; /tagihan/[id] shows the formula (Rp10.000 x hari-siswa / hari), lines per student
  (exact share, only the total is rounded) and, for the admin, "Bayar lewat Virtual Account / QRIS"
  (POST /billing/invoices/{id}/payments, one Idempotency-Key per click). The page polls the payments
  every 2 s while the worker opens the charge, every 10 s while waiting for the money.
- E2E: absah-api runs PAYMENT_PROVIDER=fake; invoices come from `billing:issue` (helpers.issueInvoice),
  the gateway's webhook is signed in the spec (helpers.fakeGatewayPaid), applied by bil.apply-payments.

## Action links and portal (apps/web/app/(portal), ORT-01/02)
- /t: the action link page from a WhatsApp message, no login. The token arrives in the #fragment, is
  kept in sessionStorage for reloads (tab only) and removed from the address bar; calls send it as
  api(..., { linkToken }) -> `Authorization: Link <token>`, cookies omitted. 401 unknown, 410
  LINK_EXPIRED. Shows first name only; one izin per link (409 link_used); "Tampilkan kartu" ->
  POST /links/card, 409 bound_elsewhere -> "Pindahkan kartu ke HP ini" (replace, after a confirm).
- /portal (PWA siswa; parents' children too): WorkspaceProvider with signInPath /masuk/hp (WhatsApp
  OTP, lib/auth.ts sendPhoneOtp/verifyPhoneOtp, normalizePhone). Cards from GET /cards/mine; a card is
  bound once per phone (POST /cards/devices) and its day keys kept in localStorage
  (absah.card.<studentId>, lib/card.ts) so the QR works offline for a week; 404 on refresh = another
  phone took it. History from GET /portal/attendance.
- CardQr redraws the QR once per 30-second window from the keys (makeCardToken); no animation.
- PWA: app/manifest.ts (start_url /portal, maskable icon), public/icons (generated PNGs), apple meta
  in the (portal) layout, public/portal-sw.js registered in production only: handles /portal, /t,
  /masuk/hp and static assets (network first, cache offline); /api and staff pages are never cached.
- Staff set WhatsApp numbers on /siswa/kontak?id=<studentId> (PUT /students/{id}/contacts; admin,
  operator, the wali kelas): guardians (messages, links) and the student's login. Numbers masked;
  an empty field keeps the number. The "Akses portal" tick per guardian sends guardians[].portal only
  when it changed (the API links the account owning the number as orang_tua); the guardian block is
  keyed on the saved portal state so form.reset() cannot bring back the old tick.
- E2E gets the link with absah-api `notify:last-link` (helpers.lastActionLink, dev only).

## Parent portal across schools (ORT-03/04/05; (portal)/portal/children.tsx, child-picker.tsx, lib/portal-children.ts)
- One login can be an orang tua at several schools. There is NO cross-school API call: ChildrenProvider (in the
  signed-in portal layout) asks every school where the login is orang_tua (parentSchools(me)) for GET
  /portal/attendance?days=1 with that school's X-School-Id, and puts the answers together (RLS decides per
  school; a school that fails shows "Sebagian sekolah belum bisa dimuat" instead of hiding the error).
- A child is keyed `<schoolId>:<studentId>` (childKey): a student id alone is only unique inside a school.
  ChildPicker ("Pilih anak", aria-pressed buttons, 44px) shows only with 2+ children and names the school only
  when there are 2+ schools. Choosing a child at another school calls selectSchool, so capabilities and the other
  portal pages (kebiasaan, penghubung, penjemput) follow the active school. The choice is remembered in
  localStorage (best effort); the provider renders only after the workspace loaded on the client, so reading it
  in the useState initialiser is safe.
- /portal for a parent shows the selected child only: GET /portal/attendance?days=30|90|180&studentId=, their
  cards (filtered to the child) and ChildLeave (GET /leave-requests?status=all matched on enrollmentId). A siswa
  is unchanged. Poin and tagihan history will come with 5.8 / 5.10 behind their capabilities.

## Message preferences (ORT-06; (portal)/portal/preferensi, lib/preferences.ts)
- /portal/preferensi (orang_tua; link on /portal): GET|PUT /portal/notification-preferences for the ACTIVE school (a
  school has its own guardian record, so choices are per school; the child picker switches school). The boxes say
  "receive" (ticked = not muted; mutedFrom/receivedFrom convert), plus "Jangan kirim setelah pukul 19.00" (held
  until 06.00, LATE_CUTOFF_LABEL from the contract's NOTIFICATION_LATE_CUTOFF_MINUTES). Only MUTABLE_TEMPLATE_CODES
  are listed; the page says safety messages always arrive. One Idempotency-Key per save, renewed on any change.
  The number is shown masked and changed by the school, not here.

## Staff Web Push (NTF-06; (staf)/pengaturan, lib/push.ts, public/portal-sw.js)
- /pengaturan ("Notifikasi di HP ini", home card for every staff member): GET /push/config { publicKey | null } ->
  pushAvailability (unsupported / off / denied / ready) -> Notification.requestPermission() on the click ->
  register /portal-sw.js (scope /) -> pushManager.subscribe({ userVisibleOnly, applicationServerKey }) ->
  PUT /push/subscriptions (subscribeBody checks the browser's JSON against the contract). "Matikan" posts
  /push/subscriptions/remove and unsubscribes the browser only when no other school still uses it (flags
  absah.push.<schoolId> in localStorage, best effort: the server does not say which endpoint is registered where).
  The browser holds one subscription, the API keeps it per school, so staff of several schools turn it on per school.
- ONE service worker: portal-sw.js already owns scope "/", and a second script at the same scope would REPLACE it
  (breaking the portal's offline card or the push, depending on who registered last). So push and
  notificationclick handlers live in portal-sw.js; the click opens only a path of this app (safePath), never
  another site. The payload is {title, body, url, tag}; `tag` collapses repeats with renotify.
- Never show anything personal in a push; the API sends generic text. Not covered by e2e (Playwright cannot get a
  real push service): the helpers are unit tested and the API side has its own tests.

## Kiosk app (apps/kiosk, GRB-02/03)
- One page, three phases (lib/use-kiosk.ts): loading -> unpaired (PairScreen: one-time code typed,
  scanned with the camera or a USB scanner; one Idempotency-Key per code) -> ready (ScanScreen).
  401 from any kiosk call = revoked: wipe the store and show pairing again.
- Calls absah-api directly (lib/kiosk-api.ts, NEXT_PUBLIC_API_URL, `Authorization: Kiosk <token>`,
  no cookies); the API allows the kiosk origin through KIOSK_ORIGINS.
- Offline: GET /kiosk/day (school-day keys today+tomorrow, lateAfter, roster with first name and
  rombel) is stored in IndexedDB (lib/store.ts; memoryStore in tests and as fallback) and
  refreshed every 30 min and on a new school date. checkLocally (lib/verify.ts) gives the instant
  verdict: verifyCardToken -> roster/bound device -> local list of today's arrivals.
- Every card token is queued (clientEventId = uuid) before the screen answers; syncQueue (lib/sync.ts)
  sends batches of 200 oldest first every 15 s, after each scan and on `online`, removing items
  only after the server answered (the server dedups by clientEventId, so resends are safe).
  Heartbeat every minute with the queue size. The server's answer is the record; the local
  verdict is only what the student sees.
- Input: Camera (BarcodeDetector, jsQR fallback, 150 ms frames) and wedgeReader (fast keystrokes
  + Enter). The same code is ignored for 5 s. Feedback: green on time, amber late/already in,
  red rejected with a short hint (lib/feedback.ts), plus a tone (lib/beep.ts).
- public/sw.js (registered in production builds only): network first, cache when offline, API
  never cached. Bump APP_VERSION (lib/use-kiosk.ts) with kiosk changes; heartbeat reports it.

## Jurnal mengajar (apps/web/app/(staf)/jurnal, PRS-09)
- The session screen (/sesi/[id]) shows "Topik pelajaran" for per_period sessions only (detail.mode),
  sent as `topic` with the same submit (max 200; empty clears). Locked sessions show it read-only.
- /jurnal (menu "Jurnal mengajar" for JOURNAL_VIEWERS when attendance.mode = per_period): month picker
  (school timezone, lib/journal.ts monthIn), GET /teaching-journal grouped per teacher; a guru sees only
  their own, JOURNAL_MANAGERS (admin, kepsek, wakasek) see all. "Unduh Excel" per teacher fetches
  /teaching-journal/export.xlsx with X-School-Id and saves the blob (file name from Content-Disposition).
- No e2e spec yet: a per_period school needs a schedule built through the UI; covered by lib tests.

## Guest book at the kiosk (apps/kiosk, GRB-11)
- The "Tamu" button on the scan screen shows only when GET /kiosk/visitor-hosts answers (404 =
  school without gate.visitors, so null hosts and no button); hosts are refreshed every 30 min.
- VisitorScreen (name, instansi, tujuan, optional host, optional photo) is online-only, unlike scans:
  an offline send keeps the form and says so. lib/visitors.ts registerVisit: optional photo first
  (POST /kiosk/visitor-photos -> PUT to the presigned URL exactly as given -> photoId), then POST
  /kiosk/visitors. An Attempt (clientEventId + Idempotency-Keys + photo ids) lives until the visit
  went through and is renewed when a field changes; a refused upload asks for a fresh link.
- PhotoCapture: front camera on demand, 640 px JPEG, camera stopped after the shot; never blocks the visit.
- The kiosk PUTs cross-origin to storage: R2 bucket CORS must allow PUT from the kiosk origins (the API's
  dev/test storage stand-in does through kioskCors). Bump APP_VERSION with kiosk changes.
- /tamu (menu "Buku tamu" for VISITOR_VIEWERS, lib/visitors.ts, when gate.enabled and gate.visitors):
  GET /visitors?date&status (date defaults to today in the school timezone), "Tandai keluar" for
  VISITOR_MANAGERS (PATCH /visitors/{id}/leave, one Idempotency-Key per guest), "Lihat foto" opens
  the 5-minute link in a tab opened before the await (popup blockers). e2e: tamu.spec.ts.

## Pulang at the kiosk (apps/kiosk, GRB-10)
- The "Pulang" button shows only when the day download has pickup (school with gate.pickup).
  CheckoutScreen: scan card -> checkForCheckout (lib/checkout.ts: same offline card check as arrivals,
  then the student's approved penjemput from day.pickup; out:<date> in the kv store = already released
  on this kiosk) -> photos to pick from -> confirm -> queued in IndexedDB store "checkouts" (DB version 2)
  and sent by syncCheckouts after the scan queue (POST /kiosk/checkouts, 200 per batch; 404 = gate.pickup
  off, queue dropped). The queue size in the header counts scans and check-outs.
- Photos: day.pickup carries 5-minute links, so refreshDay copies them into store "photos" at once
  (syncPhotos; photos of penjemput no longer listed are removed). Shown from blob: URLs, offline too.
- "Penjemput tidak terdaftar" (online only): name + photo (PhotoCapture who="penjemput", required) ->
  requestUnlisted (POST /kiosk/pickup-photos + PUT, POST /kiosk/unlisted-pickups; one Attempt until it
  went through) -> waiting screen polling GET /kiosk/unlisted-pickups/{id} every 3 s: released = green
  (and marked out), denied/expired = red. The student stays until a parent (link) or wali kelas decides.
- APP_VERSION 0.5.0.

## UKS page (apps/web/app/(staf)/uks, KSW-08)
- Menu "UKS" for UKS_STAFF (petugas_uks only, lib/uks.ts) when student.uks; even admins get 403 from
  the API (the notes are medical). Find the student (GET /uks/students?q=, 2+ letters, debounced),
  keluhan, tindakan, hasil (kembali kelas / istirahat / dipulangkan) -> POST /uks/visits with one
  Idempotency-Key per visit (renewed on any change). "Dipulangkan" asks first: it marks the rest of the
  day sakit and messages the parents. Below, the day's visits (GET /uks/visits?date=).
- e2e: uks.spec.ts invites the petugas through POST /school/invitations and helpers.acceptInvite.

## Kanal lapor TPPK (apps/web/app/(lapor), KSW-06)
- Public route group, no login, no service worker, noindex, no-referrer. /lapor?s=<schoolId> (QR poster,
  lib/tppk.ts reportUrl) asks GET /tppk/channel/{id} first; unknown id or student.tppk off = "Kanal lapor
  tidak tersedia". Anonymous is the default; an anonymous POST goes with api(..., { anonymous: true }) =
  credentials 'omit', so not even the session cookie travels. The tracking code is shown once
  (formatCode: XXXXX-XXXXX) and kept nowhere in the browser; the story is cleared after sending.
- /lapor/lacak: GET /tppk/reports/track/{code} (status only: STATUS_LABELS). 429 has its own message.
- Staff side (app/(staf)/tppk): TppkCards on home (behind student.tppk) fetch GET /tppk/members and
  show "TPPK: laporan dan kasus" to members and "Tim TPPK" (with the below-3 warning) to the admin.
  /tppk board (new reports = status diterima, open and closed cases), /tppk/laporan/[id] (story,
  reporter or "Anonim", Buat kasus), /tppk/kasus/[id] (events, langkah/catatan, close with confirm,
  reopen; one Idempotency-Key per write until it went through). /tppk/tim: admin picks active staff
  (GET /school/members -> staffCandidates), canBeNotified badge, QR poster built after mount
  (window.location.origin) to avoid a hydration mismatch.
- e2e: tppk.spec.ts is the golden flow: admin refused before joining, team of 1 (warned), anonymous
  report from the poster link, wrong code, member opens case -> "Sedang ditangani", closes -> "Selesai".

## Kegiatan (apps/web/app/(staf)/kegiatan, KEG-01)
- Menu "Kegiatan" for every staff member: GET /activities answers all for ACTIVITY_OVERSEERS and only
  the coached ones for others (lib/activities.ts). ACTIVITY_MANAGERS (admin, wakasek) create
  (name, jenis, di/luar sekolah, hari, optional dates, pembina from /school/members) and (de)activate.
- /kegiatan/[id]: pembina or managers edit the members (search GET /activities/students?q=, then one
  PUT of the whole list) and "Presensi kegiatan hari ini" (POST /activities/{id}/sessions, no
  Idempotency-Key: the API returns the same session) -> the usual /sesi/[id] screen. Rekap per month
  from GET /activities/{id}/recap, separate from the class rekap. Hari ini labels these "Kegiatan".
- e2e: kegiatan.spec.ts. helpers.acceptInvite waits until the app leaves /masuk.

## Buku penghubung (ORT-07; app/_liaison shared, (staf)/penghubung, (portal)/portal/penghubung)
- Behind portal.liaison. LiaisonThreadView (app/_liaison/thread.tsx) is shared by staff and parents:
  GET /liaison/students/{id}, POST .../read after loading (z.null() for the 204), polls every 30 s
  while visible, one Idempotency-Key per message (reset when the text changes), "Tarik pesan" while
  canRetract (confirm). body null = "Pesan ditarik"; the admin sees the text with "Ditarik pengirim".
- /penghubung: "Tulis ke orang tua" (GET /liaison/students?q=, students the user teaches),
  conversations (GET /liaison/threads with unread), admin "Jam layanan" (GET|PUT /liaison/settings).
- /portal/penghubung: a parent's children (orang_tua link on /portal). Parents get an account through
  the "Akses portal" tick on /siswa/kontak (5.4) and log in with OTP on /masuk/hp.

## Penjemputan (GRB-09/10; (portal)/portal/penjemput, (staf)/penjemputan, (portal)/t)
- lib/pickup.ts: relation and status labels, toJpeg (canvas, longest side 960, quality 0.85) and
  putPhoto (presigned PUT). The R2 bucket CORS must allow PUT from the web origin too.
- /portal/penjemput (orang_tua, gate.pickup): per child the pending/approved penjemput, "Hapus"
  (deactivate) and a form: name, relation, WhatsApp, photo (input capture=user), valid until. Photo
  first (POST /pickup-guardian-photos + PUT), then POST /students/{id}/pickup-guardians.
- /penjemputan (staff, gate.pickup; the API filters to the wali kelas's rombel): unlisted penjemput
  held at the kiosk (photo, Izinkan pulang / Tolak), new penjemput from parents (photo, Setujui /
  Tolak), and today's check-outs. Refreshes every 20 s. Photos are 5-minute presigned links shown in
  <img> (next/image would cache them past expiry).
- /t: when the link context has pickups, a "Penjemputan hari ini" card with the photo and
  allow/deny (POST /links/pickups/{id}).

## Jurnal 7 KAIH (KEG-02; (portal)/portal/kebiasaan, (staf)/kebiasaan)
- Shown when habits.kaih != 'off' (useCapability; the mode never comes from the level). lib/habits.ts:
  labels, habitsBody (all seven, unticked false), mondayOf/addDays (UTC date math on ISO dates).
- /portal/kebiasaan (siswa and orang_tua; children from GET /portal/attendance): GET /habits/{id}, the
  last 7 days newest first; days >= editableFrom and not locked get checkboxes when canEdit (the
  parent in mode parent, the student in mode student), PUT /habits/{id}/{date} with one
  Idempotency-Key per set of ticks. Others read "x dari 7".
- /kebiasaan (HABIT_SUMMARY_READERS; rombel from GET /reports/attendance/classes, which the API narrows
  to a wali kelas's own): GET /classes/{id}/habits?weekStart (Monday), days filled and ticks per habit.

## Setoran hafalan (KEG-03; (staf)/hafalan, (portal)/portal/hafalan, app/_hafalan)
- Behind religious.memorization (madrasah). /hafalan for MEMORIZATION_WRITERS (guru_tahfidz, admin;
  lib/memorization.ts): find the student (GET /memorization-logs/students?q=, 2+ letters), surah select
  (SURAH_OPTIONS from contracts SURAH_NAMES/SURAH_AYAT, ayat inputs capped at the surah), ayat awal/akhir,
  optional juz/nilai/catatan -> POST /memorization-logs, one Idempotency-Key per setoran (reset on change).
- HafalanHistory (app/_hafalan/history.tsx, GET /memorization-logs?studentId) is shared by the staff page
  and /portal/hafalan (student, and each child of a parent from GET /portal/attendance).

## PKL staff pages (apps/web/app/(staf)/pkl, PKL-01)
- Home card "PKL" for every staff member when pkl.enabled (any staff can be guru pembimbing; GET
  /pkl/placements answers all for managers and kepsek, own students for others). lib/pkl.ts mirrors
  canManagePkl (PKL_MANAGERS: admin, wakasek, humas_pkl) and canSeeAllPkl (PKL_OVERSEERS, + kepsek).
- /pkl: placements (scope current|all), managers "Ubah" (PATCH endsOn + pembimbing industri; an empty
  number keeps the stored one, the tick sends null) and "Batalkan" (POST .../cancel after a confirm).
- /pkl/dudi: partners with workHoursLabel; managers add/edit (point pasted from Google Maps, parsed by
  parseCoordinates; radius 25-2000; hours per weekday, Mon-Fri 08-16 by default; active tick on edit).
- /pkl/penempatan: batch placement: DUDI, students picked from GET /pkl/students?q=, period, guru
  pembimbing (GET /pkl/school-mentors), optional pembimbing industri (name + WhatsApp, normalizePhone).
  409 overlap lists the picked students named in details.enrollmentIds.

## PKL review and industry supervisor (PKL-02/03; (staf)/pkl/tinjauan, (staf)/pkl/jurnal, (dudi)/dudi, app/_pkl)
- /pkl/tinjauan: GET /pkl/reviews (the API gives the guru pembimbing their own, managers all): check-in
  time (school clock, lib/pkl.ts clockIn), distance, GPS accuracy, reasons, dispute text, or "Tidak ada
  check-in"; H/T/S/I/A buttons POST /pkl/days/{sessionId}/decide, one Idempotency-Key per (day, status).
- PklJournals (app/_pkl/journals.tsx) is shared by /pkl/jurnal, /dudi/jurnal and the student portal:
  GET /pkl/journals[?query], attachment through the 5-minute link (tab opened before the await),
  Setujui / Minta revisi (note required) when canReview and submitted.
- /dudi: WorkspaceProvider with signInPath /masuk/hp (the WhatsApp message links /dudi; after OTP the
  login page returns there via ?lanjut). pembimbing_industri only. GET /pkl/supervision?date (statuses,
  never locations), "Konfirmasi n siswa hadir" (POST /pkl/checkins/confirm {date}), "Sanggah" with a
  reason (POST /pkl/checkins/{id}/dispute). /portal sends an industry supervisor to /dudi.

## PKL for the student ((portal)/portal/pkl, PKL-02/03)
- Link on /portal for siswa when pkl.enabled. GET /pkl/me: DUDI, today's hours, supervisors, today's
  check-in/out (never coordinates). "Check-in sekarang" / "Check-out pulang" read the location once
  (lib/pkl.ts readPosition: high accuracy, 20 s, no cache; geoErrorMessage for denied/timeout/no GPS),
  then POST /pkl/checkins. One Attempt {key, body} per press is resent unchanged after a network error
  (a new position would be another body: 422 on the same key); any API answer ends it (409 reloads).
- Jurnal hari ini: optional photo (toJpeg) or PDF -> POST /pkl/journals/attachments + putPhoto, then
  POST /pkl/journals; "Jurnal saya" is PklJournals without the student column.
- e2e golden-smk.spec.ts: DUDI (today's hours start half an hour from now, so the check-in is on time),
  batch placement with a pembimbing industri, two students' phones as contexts with geolocation (one at
  the gate, one ~900 m away), the supervisor confirms with one tap on /dudi and approves the journal, the
  guru pembimbing decides the far check-in on /pkl/tinjauan. Select by role (combobox name), not
  getByLabel: a wrapping <label> includes the option texts.

## Golden e2e (5.4)
- golden-sd.spec.ts: daily session + WA alpa, parent portal login (helpers.otpLogin reads the code with
  absah-api `auth:last-otp`), penjemput with photo (helpers.TINY_PNG) approved on /penjemputan, kiosk
  Pulang offline with the stored photo, unlisted penjemput (fake camera: launchOptions args in
  playwright.config.ts, context permissions ['camera']) allowed by the other parent through /t.
  gateFixture cards carry studentId; helpers.lastMessage gives the newest template code + link.
- golden-smp.spec.ts: two lessons put on today's weekday through the API, per-period session filled,
  the student's own login ticks 7 KAIH, the wali kelas reads the week on /kebiasaan.

- golden-ortu.spec.ts (5.7i): two schools with the Dapodik roster (each admin in its own context), ONE parent
  number opened for Aditya at school A and Bunga at school B through /siswa/kontak, then the portal: "Pilih anak"
  with both children and their schools, choosing a child shows only that child and switches the school, 90-day
  history, and /portal/preferensi saved per school (B changed, A still default). Ends with an API check that
  school A lists only Aditya. A held late message is NOT asserted here (it depends on the real clock): api
  test/notify-preferences.test.ts covers it.

## Poin kesiswaan (apps/web/app/(staf)/poin, KSW-02)
- Pins api commit 11bb2af (new role guru_bk, capabilities student.points, student.counseling, student.early_warning,
  template student_discipline_threshold: the Record<> label maps in lib/capability-labels.ts, lib/notify.ts and
  lib/roles.ts must name them or typecheck fails).
- Menu "Poin kesiswaan" for POINT_RECORDERS (admin, wakasek, wali kelas, guru; lib/ksw.ts mirrors the API policies)
  when student.points. Pick the student (shared <StudentPicker>, GET /point-entries/students?q= because teachers
  cannot read the registry), the rule (GET /point-rules, grouped by kind; the API copies the points, nothing is
  typed), a date (today up to 30 days back), a note and optional photo/PDF. Evidence: checkEvidence (type, 5 MB) then
  POST /point-entries/evidence, PUT to the presigned URL with putPhoto, then POST /point-entries with the id.
  A pelanggaran asks window.confirm first. One idempotency key per entry until it went through.
- /poin/[enrollmentId] (admin, kepsek, wakasek, wali kelas of the class; others get a message, the API 404/403):
  net totals, entries newest first, evidence link on request (an <a> after the link is fetched, a popup would be
  blocked), "Batalkan" with a reason for admin and wakasek (a reversal never edits history).

## Aturan, tugas tindak lanjut, peringatan dini (KSW-01, 03, 04)
- /poin/aturan: rules (GET /point-rules?all=<manage>) and thresholds (GET /point-thresholds?all=<manage>), readable by
  everyone who reaches /poin, written by POINT_MANAGERS (admin, wakasek). The form asks for a plain amount (1..100); the
  kind gives the sign (signedForKind), so a minus typed by habit never flips a pelanggaran. Rules and tiers are only
  switched off, never deleted (entries and tasks cite them).
- /tindak-lanjut (FOLLOWUP_READERS, student.points): open/done filter; FOLLOWUP_CLOSERS (not kepsek) close a task with an
  optional note. A 409 reloads the list ("sudah selesai").
- /peringatan-dini (student.early_warning, the URL the push opens): 7/14/30 days; the API scopes wali kelas to the class.
  Student names link to /poin/[enrollmentId] only for POINT_PROFILE_READERS (guru_bk has no profile access).

## Catatan BK (apps/web/app/(staf)/bk, KSW-05)
- Pins api commit d72b672 (GET /counseling-notes/students?q= for the guru BK, who does not read the registry).
- Card and page for BK_READERS (guru_bk, admin) when student.counseling. Only BK_WRITERS (guru_bk) see the form
  (student picker, date up to today, note up to 2000, follow-up none/planned + optional date) and the "Tandai
  tindak lanjut selesai" button; the admin reads. Filter planned (default) / done / all -> ?followUp=. A 409 on
  complete just reloads the list. The note text lives only in component state and the response, never in logs,
  localStorage or analytics; do not add it to any of those.

## Kesiswaan e2e (e2e/kesiswaan.spec.ts)
- One golden path: admin writes a rule (Membolos, -30) and a threshold (25), records it for ADITYA (confirm dialog), sees
  -30 on the profile, closes the follow-up task that the threshold made, reverses a second entry (reason required),
  then a guru BK (invited by the admin) writes a note with a planned follow-up, closes it, and the admin reads it
  with no form. Not run locally (stale servers on 4710/3710); CI is the judge. Not covered: evidence upload (needs the
  object store; api tests cover the contract), the 18.00 early-warning job and push (clock/VAPID), parent WhatsApp.

## Guru: absen dan izin (apps/web/app/(staf)/absen-guru, izin-guru; GRU-01/02)
- Pins api 5786750 (capability teacher.attendance, TEACHER_* role constants). lib/teacher.ts builds its role lists from the
  contracts' constants (TEACHER_CHECKIN_ROLES, TEACHER_LEAVE_DECIDERS, ...) instead of copying them.
- /absen-guru (TEACHER_CHECKIN): GET /teacher-attendance/today, then "Absen masuk" / "Absen pulang" ("Perbarui jam
  pulang" once out; the latest wins). The API decides late against the school start; the page only says it
  (checkInSummary, times on the school clock through clockLabel, never UTC). One idempotency key per tap until it
  went through. Not a school day: no button.
- /izin-guru: teachers ask (kind, dates, reason) and withdraw their own izin (mayCancelTeacherLeave mirrors the API);
  TEACHER_LEAVE_DECIDING (wakasek, kepsek, admin) see the pending queue minus their own and approve or reject with an
  optional note. Cards on the home page by role + capability.

## Guru pengganti (apps/web/app/(staf)/pengganti; GRU-03)
- /pengganti (SUBSTITUTION_READING = wakasek, piket, kepsek, admin): GET /substitutions?date= lists sessions whose teacher is
  on approved izin, "needed" or already covered; the count of uncovered sessions is shown on top. Only sessions the
  school already generated for that day appear, which the page says.
- SUBSTITUTION_ASSIGNING (wakasek, piket, admin) pick from GET /substitutions/candidates (ranked by the API: checked
  in, same subject, fewest this month; the page only prints why via candidateNotes) and POST /substitutions. On a 409 the
  reason is shown and the candidate list reloads, since someone else may have just taken that teacher.

## Kehadiran guru (apps/web/app/(staf)/laporan-guru; GRU-04)
- /laporan-guru (TEACHER_REPORT_READING = kepsek, wakasek, admin): GET /teacher-attendance/report?month=, month stepper
  (no going past this month), totals line, a table per teacher; clicking a name refetches with teacherId for the day by
  day with check-in/out times on the school clock. A "no record" day is never labelled alpa. Only the answer to the
  current month/teacher is shown (loaded.key), never the previous month's while loading.
- No export yet; the API has none (JSON only).

## E2E guru (apps/web/e2e/guru.spec.ts)
- SD school (daily sessions by wali kelas): Bu Wali (wali_kelas) holds VII A; Pak Pengganti (guru) is free. Check-in is
  only exercised on Mon-Fri on the Jakarta clock (the API answers 409 not_school_day otherwise, and there is no calendar
  endpoint to open a weekend); on a weekend the spec asserts the "bukan hari sekolah" message and no button instead.
- Flow: izin today -> /pengganti still empty while pending -> admin approves -> VII A shows "Belum ada pengganti" and the
  count -> candidates (the absent teacher is not offered) -> assign -> report row of Pak Pengganti shows 1 mengganti and
  Bu Wali's daily detail opens. Clash prevention is the API's tests (teacher-substitutes), not repeated here.

## Tagihan siswa and ujian: shared helpers (5.10; lib/student-billing.ts, lib/exam.ts)
- lib/billing.ts is the school's own Absah SUBSCRIPTION ("Tagihan Absah", /tagihan). Student fees (SPP, kegiatan; TGH) live in
  lib/student-billing.ts with pages under /tagihan-siswa and /portal/tagihan; the roles come from the contracts
  (BILLING_MANAGERS = bendahara + admin write, BILLING_READERS add kepsek + wakasek). rupiah/dateLabel/groupDigits are reused
  from lib/billing.ts. evenInstallments splits an amount into n monthly parts that add up exactly (first parts carry the odd
  rupiah); addMonths keeps the last day of a short month; parseRupiah reads "250.000", never decimals.
- lib/exam.ts: role lists from the contracts (EXAM_MANAGERS wakasek+admin, EXAM_VIEWERS add kepsek+wali_kelas), reasonLabel
  (own attendance % and the minimum, count of open installments, never an amount), ruleSummary, examWindowLabel and
  checkInProblem (API reason/cardReason -> what the pengawas does next).

## Tagihan siswa, staff pages (apps/web/app/(staf)/tagihan-siswa; TGH-01/02/04)
- Home card "Tagihan siswa" (STUDENT_BILLING_READING, behind student.billing). /tagihan-siswa lists GET
  /student-billing/bills with filters (status default "Belum lunas", jenis, rombel, periode, hanya lewat jatuh tempo);
  "Batalkan" (prompt for a reason, POST .../void) only for managers on an open bill with nothing paid (the API refuses
  has_payments anyway). Links: /rekap for readers, /terbitkan and /jenis for bendahara + admin.
- /jenis: fee types (POST, PATCH active / defaultAmount via prompt; never deleted). Changing the amount does not touch bills.
- /terbitkan: jenis, periode, optional judul and nominal, target rombel or angkatan, "Dibayar dalam" 1..12 with a preview from
  evenInstallments, then POST /student-billing/issue with ONE Idempotency-Key per form state (any change renews it). The
  answer says how many were created and how many were skipped because they already existed. Rombel come from
  GET /student-billing/classes (the bendahara cannot read /classes).
- /rekap: GET /student-billing/recap?month=&feeTypeId=: money received that month by day and method, a notice when payments
  were flagged (counted for nothing), and owed per rombel. Only the answer to the current month/filter is shown (loaded.key).

## Tagihan sekolah for parents and students ((portal)/portal/tagihan; TGH-03)
- Link on /portal behind student.billing. GET /student-billing/mine (the caller's own children, by guardians.user_id, or the
  student themself), grouped per child (first name + rombel), bills to pay first, "Sudah lunas" folded. One installment is
  offered at a time (nextInstallment); a multi-installment bill lists all its cicilan.
- Pay: "Bayar lewat Virtual Account" / "Bayar lewat QRIS" -> POST /student-billing/installments/{id}/payments, one
  Idempotency-Key per click. While a charge is open (requested/pending) the buttons are hidden and the screen polls every 2 s
  (worker opening the VA/QR) or 10 s (waiting for the money); expired/failed shows "minta yang baru". The VA is shown in
  groups of four (groupDigits) with the bank and expiry on the school clock; QRIS is drawn from qrString with `qrcode`.
  409 payments_unavailable (no PaymentProvider) shows the API's message ("Hubungi sekolah").
- No amounts or bills in the WhatsApp reminder: it only says something is due and links to the portal.

## Ujian, staff pages (apps/web/app/(staf)/ujian; UJN-01/02/03)
- Home card "Ujian" (EXAM_VIEWING) or "Ruang ujian saya" (any other staff member), behind exam.enabled. /ujian lists the
  exam periods (closed ones on request) with ruleSummary; managers (wakasek, admin) create one with PeriodFormFields
  (shared with "Ubah aturan": min attendance %, sakit/izin counted, count-from date, bills that must be paid and which fee
  types). One Idempotency-Key per form state. Every pengawas also sees "Ruang yang saya awasi" from GET /exam/my-rooms.
- /ujian/[id]: rule, close/reopen, and "Boleh ujian": GET .../eligibility, only those who may not sit by default, with
  reasonLabel per reason (never amounts); wali kelas get their own rombels (the API scopes), others pick a rombel.
  There is no single-period read; the page finds its period in the list with includeClosed.
- /ujian/[id]/ruang: rooms with seated/capacity/pengawas, the count of students without a room, create (pengawas from
  /school/members through staffCandidates), "Isi dengan rombel" (POST students {classId}; moves from other rooms; 409
  room_full changes nothing), delete (204 -> z.null()).
- /ujian/ruang/[roomId]: GET attendance; check-in by a scanner typing the card text into the field + Enter (POST /scan,
  the same dynamic card QR as the daily card) or "Catat hadir" (POST /attendance, manual); refusals read through
  checkInProblem. A student who may not sit shows "Belum boleh ujian" with no button. There is no camera scanner on this page.

## Kartu ujian for parents and students ((portal)/portal/ujian; UJN-01/03)
- Link on /portal behind exam.enabled. GET /exam/mine (own children only), exams that are not over by the school date.
  examCardView(exam, today) decides: `show` (exam day, may sit, not yet in) draws CardQr from the keys the daily card
  already stored on this phone (`absah.card.{studentId}`, the same QR the gate reads, so nothing new is stored); without
  keys it points to the portal home to activate the card. `blocked` lists the reasons (reasonLabel, never amounts) and
  says to contact the school; `before` says whether the child may sit now; `arrived` says the child is checked in.
- The room and seat show as soon as the school arranges them ("Ruang belum diatur sekolah" until then).

## e2e for tagihan siswa and ujian (apps/web/e2e/tagihan-siswa.spec.ts, ujian.spec.ts)
- Both import the 10-student SMP fixture, turn the capability on with PUT /school/capabilities and drive the staff pages as
  the admin: fee type -> issue to a rombel twice (the second says they already have it) -> cancel one with a reason -> recap;
  and exam today -> rooms -> seat VII A -> manual check-in. They do not pay or scan: paying needs the gateway worker and a
  parent login, scanning needs a card phone, both covered by the API tests and the pure helpers. CI judges these specs.

## Sesi offline (PRS-08; lib/offline-queue.ts, lib/sync-sessions.ts, (staf)/offline-sync.tsx)
- Pins api e11b771 (later bumped: see apps/web/package.json; POST /sessions/{id}/sync, GET /gate/board, /workspace/exports). The staff layout mounts <OfflineSync>:
  it sends the queue on load, on `online`, when the tab is visible and every 15 s while something waits, and shows what
  happened per session (terkirim / koreksi diajukan because the session was locked meanwhile / tidak ada perubahan /
  tidak terkirim + the API's reason). Nothing is dropped silently: only an API answer (even a refusal) removes an item;
  no answer (TypeError, 408/429/502/503/504) keeps it, 401 keeps it for the same user.
- Store (IndexedDB `absah-staff-offline`: `queue`, `cache`; memoryStore in tests and as fallback): the queue is keyed
  `${userId}:${sessionId}` (filling again replaces the entry) and each item keeps its own Idempotency-Key, so a resend after
  a lost reply gets the same answer. capturedAt is the moment of "Kirim". The cache holds copies of /me/context, the Hari ini
  list and the details of the open sessions (prefetched by /hari-ini), shown with "Tanpa sinyal ... pukul HH.MM". Sign-out
  clears the copies (rosters) but not the queue.
- /sesi/[id]: on a transient failure the submit is queued instead of failing ("Disimpan di HP"); a session waiting in the queue
  shows the answers that were given. Corrections of locked sessions are NOT queued (they need a reason and a decision).
- public/portal-sw.js (cache v2) also keeps the page shells of /hari-ini and /sesi/<id> (navigations, plus the x-absah-warm
  requests /hari-ini sends), never API responses; registered by the staff layout in production only.
- e2e presensi-offline.spec.ts: `next dev` has no service worker, so "no signal" is `page.route('**/api/v1/**', abort)`;
  two sessions of one wali kelas are filled that way, then the route is removed and the 15 s retry sends both.

## Papan kedatangan (GRB-08; (staf)/gerbang/papan, lib/gate.ts)
- /gerbang/papan (link on /gerbang; GATE_VIEWERS, behind gate.enabled): GET /gate/board = counts only, per rombel on time / late /
  not in yet (`excused` = covered by an approved izin, shown as "(n izin)" and left out of toChase). Polled every BOARD_POLL_MS
  (5 s) with a self-rescheduling timeout, only while the tab is visible (visibilitychange fetches at once); a failed poll keeps the
  last board and, after BOARD_STALE_MS (20 s) without an answer, a notice says the numbers may have changed. Rombel with most
  students to chase first (boardOrder). Updated time is the server's, on the school clock. No names here: the lists stay on /gerbang.
- e2e papan-kedatangan.spec.ts: board opens at 0, a manual arrival made through the API shows up without a reload.

## Ekspor data sekolah (PLT-11; (staf)/ekspor-data, lib/workspace-export.ts)
- Home card "Ekspor data sekolah" for the admin only (isAdmin; the API gives 403 to others). /ekspor-data: tick "Sertakan berkas
  unggahan" (default on), "Minta ekspor" = POST /workspace/exports with ONE Idempotency-Key per form state (renewed on a change, kept
  after a lost reply, dropped after any API answer; 409 = one is already being built, shown from the API). GET /workspace/exports is
  polled every 3 s only while a row is `queued` (the button then says "Sedang dibuat" and is disabled).
- Done rows show tables, files, size, "termasuk data TPPK" only when the API says includesTppk (the admin must be on the TPPK team
  to get that schema), and "Tersedia sampai" = finished + WORKSPACE_EXPORT_RETENTION_DAYS (7). "Unduh" opens a tab inside the click
  (popup blockers), asks GET .../download for the 5-minute link and points the tab at it; 409 expired/not_ready reloads the list.
  Every download is audited by the API. The page never reads or parses the ZIP.
- e2e ekspor-data.spec.ts: admin of the SD fixture requests, the worker finishes (up to 90 s), the link serves a ZIP containing
  tabel/students.csv and README.txt.

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

## Dasbor dan rapor karakter (RKP-05, RKP-06, KEG-04)
- `/dasbor` (admin, kepsek, wakasek; card on the home page): GET /dashboard/principal. Tiles link to the report they summarise (/rekap,
  /rekap/kepatuhan, /peringatan-dini, /mbg); `atRisk` and `mbg` are null when the school lacks the capability, so those tiles are
  simply absent. The trend is a list of CSS bars (data.module.css .trend), no chart library; a day without rekap is an empty bar.
- `/dasbor/yayasan` (RKP-06): GET /dashboard/collections has no school header; the API reads every school in its own tenant. The
  link on /dasbor only shows when that list is not empty. Schools are listed lowest attendance first (lib/dashboard.ts schoolsByAttention).
- Rapor karakter (KEG-04) is a button on the rombel's rekap page (ExportButtons with classId): POST /exports/character-reports, then
  the same poll-and-download loop as the rekap files. e2e: rekap.spec.ts covers all three.

