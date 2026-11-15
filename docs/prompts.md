# Absah — Prompt Claude Code

Nov 16, 2026 · @Surya Rafliansyah

## Cara pakai

Dokumen ini berisi `CLAUDE.md` untuk repo Absah dan urutan prompt siap tempel untuk Claude Code, dari repo kosong sampai paket fitur per jenjang. Acuannya [Absah — Arsitektur Teknis v2](https://claude.ai/artifact/TsXU6Wp3sZ1uttZXy1GfFF).

**Prasyarat**

- Repo baru (mis. `absah`) dengan Node 22 LTS dan pnpm 9 terpasang; repo lama `project-attendance` (Laravel) disimpan terpisah untuk ETL.
- Akun Neon (project di `aws-ap-southeast-1`), Cloudflare (R2 + DNS), dan sandbox penyedia WhatsApp Business API. Kredensial disimpan di `.env.local`, **tidak pernah** ditempel ke chat Claude Code.
- Folder `docs/` di repo berisi salinan Markdown dari dokumen arsitektur v2 (`docs/architecture.md`), baseline (`docs/baseline.md`), dan dokumen prompt ini (`docs/prompts.md`), diekspor dari masing-masing doc. Prompt merujuk ke file-file ini.

**Alur kerja per prompt**

1. Mulai **sesi baru** untuk setiap prompt bernomor, supaya konteks bersih. `CLAUDE.md` otomatis dibaca di awal sesi.
2. Tempel prompt apa adanya. Setiap prompt meminta Claude Code membuat rencana dulu; baca rencananya dan setujui atau koreksi sebelum ia menulis kode.
3. Biarkan ia menjalankan `pnpm turbo lint typecheck test` sampai hijau. Prompt sudah meminta ini, tetapi periksa sendiri hasil akhirnya.
4. Tinjau diff, lalu minta ia membuat commit dan PR ke branch `main` dengan judul `[fase-langkah] ringkasan`.
5. Isi checklist di bagian **Checklist per PR** sebelum merge.
6. Bila ada yang salah, pakai prompt pendukung (review, bug, refactor) di sesi yang sama, bukan menambal manual tanpa uji.

**Aturan menulis prompt tambahan**

- Sebut kode fitur (mis. `PKL-02`) dan bagian dokumen arsitektur yang relevan.
- Batasi satu prompt pada satu modul atau satu irisan vertikal (DB → use case → API → UI → uji). Prompt yang menyentuh lebih dari dua modul biasanya menghasilkan diff yang sulit ditinjau.
- Sebutkan kriteria selesai yang bisa diuji, bukan "buat sebaik mungkin".
- Jangan minta Claude Code menonaktifkan RLS, melewati uji, atau memakai `any` untuk mempercepat; aturan itu sudah tertulis di `CLAUDE.md`.

**Urutan prompt**

| Fase | Prompt | Hasil |
| --- | --- | --- |
| 0 | 0.1–0.3 | Monorepo, paket bersama, server dua entrypoint, CI |
| 1 | 1.1–1.5 | Auth, workspace, RLS, outbox, idempotensi, capability dan profil jenjang, wizard setup |
| 2 | 2.1–2.4 | Import Dapodik, rombel, jadwal, mesin sesi, izin |
| 3 | 3.1–3.3 | Kios dan kartu QR, notifikasi WhatsApp, portal |
| 4 | 4.1–4.4 | Rekap dan ekspor, MBG, billing, data uji pilot |
| 5 | 5.1–5.11 | Paket P1 per jenjang dan modul P1 lainnya |

Fase 6 (prompt 6.1–6.3) berisi fitur P2 dan dijalankan sesuai permintaan pelanggan. Dengan begitu setiap fitur di inventaris (106 fitur) punya prompt yang menanganinya.

## CLAUDE.md

Simpan sebagai `CLAUDE.md` di root repo. Isinya sengaja berbahasa Inggris agar konsisten dengan nama kode, dengan glosarium istilah sekolah dalam bahasa Indonesia. Perbarui file ini setiap kali ada keputusan arsitektur baru; Claude Code membacanya di setiap sesi.

```markdown
# Absah

School attendance SaaS for Indonesian schools (SD/MI, SMP/MTs, SMA/MA, SMK/MAK).
Multi-tenant: one workspace = one school; workspaces group into collections (yayasan).
Full design: docs/architecture.md. Feature codes (e.g. PRS-03, PKL-02) refer to it.

## Stack
- pnpm workspaces + Turborepo, TypeScript strict everywhere.
- apps/web: Next.js 16 App Router; route groups (staf), (portal), (dudi). Portal is a PWA.
- apps/kiosk: Next.js static export, offline-first, IndexedDB queue.
- apps/server: Express 5. Entrypoints src/entrypoints/http.ts and worker.ts.
- packages/contracts: Zod schemas per endpoint, OpenAPI generated from them.
- packages/db: Drizzle schema, SQL migrations, RLS policies, seeders, MySQL ETL.
- packages/capabilities: capability catalog + level presets. Pure data, no I/O.
- packages/ui: design system. packages/config: shared tsconfig, eslint, vitest, depcruise.
- Postgres on Neon (pooled, transaction mode). Jobs: pg-boss in the same DB.
- Auth: Better Auth. Files: Cloudflare R2, private bucket, presigned URLs only.

## Commands
- pnpm dev                       run web, kiosk, server http + worker
- pnpm turbo lint typecheck test  must pass before you say a task is done
- pnpm --filter @absah/db db:generate | db:migrate | db:seed | db:check-rls
- pnpm --filter @absah/contracts openapi
- pnpm --filter @absah/web e2e   Playwright

## Server module layout (apps/server/src/modules/<module>)
domain/ (pure rules, no imports of db/express) -> application/ (use cases) ->
infrastructure/ (Drizzle repos, adapters) -> http/ (routers) -> jobs/ -> index.ts (public API).
Other modules import ONLY from <module>/index.ts. Cross-module side effects go through outbox events.

## Non-negotiable rules
1. Every tenant table has school_id uuid not null, an index starting with school_id, and an RLS policy.
   Never add BYPASSRLS, never query outside withTenant(ctx, fn). Run db:check-rls after migrations.
2. Every write endpoint accepts Idempotency-Key. Kiosk, PKL check-in and payment endpoints require it.
3. Never call WhatsApp, payment or email from a request handler. Write an outbox event in the same
   transaction; the worker performs the side effect.
4. Never branch on school level (no if level === 'sd'). Read capabilities from req.ctx.caps and
   guard routes with requireCap(key). Level only sets capability defaults in packages/capabilities.
5. One session engine: class, daily (SD), activity and PKL attendance all use attendance_sessions
   and attendance_records with a mode. Do not create parallel attendance tables.
6. Validate every request and response with the Zod contract from packages/contracts.
7. No any, no ts-ignore, no disabled tests to make CI green. If blocked, stop and explain.
8. Dates: timestamptz in UTC; school_date computed in the school timezone (default Asia/Jakarta).
9. Personal data: no names, phone numbers or NISN in logs. Sensitive text columns (TPPK, BK, UKS
   notes, pickup phone) are encrypted with the crypto helper in shared/crypto.
10. The tppk schema is readable only by TPPK members; support access never includes it.

## Testing expectations
- Domain rules: Vitest unit tests next to the code.
- Repositories and RLS: integration tests against Postgres (docker compose or Neon branch).
- Every new endpoint: Supertest test for happy path, validation error, wrong role,
  capability disabled, and idempotent replay.
- Jobs: test with real pg-boss, school timezone and retries.

## Working style
- Before writing code, post a short plan: files to add/change, migrations, endpoints, tests.
- Work in vertical slices: migration -> domain -> use case -> contract -> route -> UI -> tests.
- Keep PRs under ~600 changed lines excluding generated files; split otherwise.
- When a requirement is ambiguous, check docs/architecture.md first, then ask.
- UI copy is Indonesian, short and plain ("Semua hadir kecuali…"). Code, comments, commits in English.

## Glossary
rombel = class group; wali kelas = homeroom teacher; guru mapel = subject teacher;
piket = duty teacher; S/I/A = sakit/izin/alpa (sick/excused/absent), H = hadir, T = terlambat;
izin = leave request; TPPK = school anti-violence team; UKS = school clinic;
PKL = industry internship (SMK); DUDI = industry partner; pembimbing = supervisor;
7 KAIH = seven habits journal; MBG = free school meal program, PIC MBG = meal coordinator;
Dapodik / EMIS = national student databases (MoE / Ministry of Religious Affairs);
e-Rapor / RDM = report-card systems (MoE / madrasah); yayasan = foundation owning schools.
```

## Fase 0: fondasi monorepo

### Prompt 0.1 — Kerangka monorepo

```text
Baca CLAUDE.md dan docs/architecture.md bagian "Struktur monorepo dan anatomi modul".

Tugas: buat kerangka monorepo Absah dari repo kosong ini.
- pnpm workspace + Turborepo dengan pipeline lint, typecheck, test, build, dev.
- packages/config: tsconfig base (strict, noUncheckedIndexedAccess), eslint flat config,
  preset vitest, aturan dependency-cruiser (modul server hanya boleh impor <modul>/index.ts
  modul lain; domain/ tidak boleh impor db, express, atau infrastructure/).
- packages/contracts, packages/db, packages/capabilities, packages/ui: paket kosong yang bisa
  diimpor dengan nama @absah/<paket>, masing-masing dengan satu uji contoh.
- apps/web (Next.js 16 App Router, route group (staf), (portal), (dudi) dengan halaman placeholder),
  apps/kiosk (Next.js output: 'export'), apps/server (lihat prompt 0.2, cukup folder dulu).
- .editorconfig, .nvmrc (Node 22), .env.example per app tanpa nilai rahasia.

Selesai bila: pnpm install bersih, pnpm turbo lint typecheck test hijau, dan pnpm dev
menjalankan web dan kiosk. Tulis rencana dulu, tunggu persetujuan saya, lalu kerjakan.
```

### Prompt 0.2 — Server Express dua entrypoint dan database

```text
Lanjutkan dari kerangka monorepo. Baca CLAUDE.md dan docs/architecture.md bagian
"Stack dan topologi runtime" serta "Model data > Isolasi tenant".

Tugas:
1. apps/server dengan Express 5:
   - src/entrypoints/http.ts: app Express, helmet, pino logger dengan redactor data pribadi,
     requestId, error handler yang mengembalikan { code, message, details?, requestId },
     router /api/v1 dengan GET /health.
   - src/entrypoints/worker.ts: inisialisasi pg-boss, satu job contoh, shutdown yang rapi.
   - src/shared/: config (validasi env dengan Zod), errors (AppError + kode stabil), logger, db.
2. packages/db dengan Drizzle + driver Postgres untuk Neon:
   - helper withTenant(ctx, fn) yang membuka transaksi lalu menjalankan
     select set_config('app.school_id', $1, true) dan set_config('app.user_id', $2, true).
   - tabel pertama: schools (id uuidv7, name, timezone default 'Asia/Jakarta', level, is_madrasah,
     npsn, nsm, collection_id, created_at) dan collections.
   - skrip db:check-rls yang gagal bila ada tabel ber-kolom school_id tanpa RLS aktif dan policy.
   - docker-compose.yml berisi Postgres 16 untuk uji lokal.
3. Uji integrasi: withTenant dengan dua sekolah membuktikan sekolah A tidak bisa membaca
   sekolah B (pakai tabel contoh tenant_probe yang dihapus lagi di akhir uji bila perlu).

Selesai bila: pnpm dev menjalankan http dan worker, /api/v1/health 200, uji RLS lulus,
db:check-rls lulus. Tulis rencana dulu.
```

### Prompt 0.3 — CI dan lingkungan

```text
Tugas: siapkan CI dan lingkungan untuk Absah.
- GitHub Actions: job install (cache pnpm), lint, typecheck, test dengan service Postgres 16,
  db:migrate dari nol, db:check-rls, dependency-cruiser, dan diff OpenAPI
  (gagal bila packages/contracts berubah tanpa file OpenAPI yang dibangkitkan ikut diperbarui).
- Workflow preview opsional yang membuat branch Neon per PR memakai secret NEON_API_KEY
  (jangan tulis nilai secret di repo; cukup referensi ${{ secrets.* }}).
- Dokumentasikan variabel lingkungan di docs/environments.md: dev, preview, staging, production,
  termasuk R2 bucket per lingkungan dan DATABASE_URL pooled vs direct (migrasi pakai direct).
- Tambahkan template PR .github/pull_request_template.md berisi checklist dari bagian
  "Checklist per PR" di docs/prompts.md.

Selesai bila: workflow lulus di PR uji. Jangan menjalankan perintah yang memakai kredensial nyata.
```

## Fase 1: platform

### Prompt 1.1 — Auth, workspace, dan peran (PLT-01, PLT-02, PLT-03)

```text
Baca CLAUDE.md dan docs/architecture.md bagian "Keamanan > Akses dan peran".

Tugas: modul platform di apps/server/src/modules/platform.
- Better Auth dengan adapter Drizzle: login email + password untuk staf, 2FA TOTP wajib untuk
  peran admin dan operator, OTP WhatsApp untuk orang tua dan pembimbing industri (pengirim OTP
  lewat interface MessageSender; implementasi palsu untuk dev dan uji).
- Tabel memberships(user_id, school_id, role, academic_year_id nullable, status) dan collections.
  Peran: admin, operator, kepsek, wakasek, wali_kelas, guru, piket, petugas_uks, tppk,
  pembina, humas_pkl, pembimbing_pkl, pembimbing_industri, orang_tua, siswa.
- Middleware resolveContext: baca sesi, header X-School-Id, cek membership aktif, isi
  req.ctx = { userId, schoolId, roles, caps } (caps diisi di prompt 1.4; sementara objek kosong).
- Helper authorize(policy) per use case, bukan per route saja.
- GET /api/v1/me/context mengembalikan user, daftar sekolah, peran di sekolah aktif.
- Rate limit /api/auth/* di level aplikasi sebagai cadangan WAF.

Uji: login, 2FA wajib untuk admin, pengguna tanpa membership ditolak X-School-Id,
peran salah ditolak 403. Tulis rencana dulu.
```

### Prompt 1.2 — Audit log dan enkripsi kolom (PLT-04, PLT-05)

```text
Tugas:
- Tabel audit_logs (school_id, actor_user_id, action, entity, entity_id, before jsonb terbatas,
  after jsonb terbatas, ip_hash, request_id, created_at) dengan RLS; hanya admin yang bisa membaca.
- Helper audit(ctx, action, entity, diff) yang dipanggil dari use case, bukan dari router.
- shared/crypto: enkripsi AES-256-GCM untuk kolom sensitif dengan kunci dari env, dukungan
  rotasi kunci (key id disimpan di ciphertext). Tipe Drizzle custom encryptedText.
- Redactor logger: pastikan nama, nomor HP, NISN, NIK, dan isi kolom terenkripsi tidak pernah
  masuk log (uji dengan snapshot log).

Selesai bila uji enkripsi bolak-balik, rotasi kunci, dan redactor lulus.
```

### Prompt 1.3 — Idempotensi dan outbox (PLT-13)

```text
Baca docs/architecture.md bagian "Job, event, dan integrasi".

Tugas:
- Tabel idempotency_keys (school_id, key, user_id, request_hash, response_status, response_body,
  created_at, expires_at 24 jam). Middleware idempotent(): request sama + key sama -> balas
  respons tersimpan; key sama + body beda -> 422 IDEMPOTENCY_KEY_REUSED; request yang masih
  berjalan -> 409.
- Tabel outbox_events (id, school_id, type, payload jsonb, trace_id, created_at, published_at).
  Helper emit(tx, type, payload) yang hanya bisa dipanggil dengan transaksi aktif.
- Job outbox.relay di worker: ambil batch dengan FOR UPDATE SKIP LOCKED, kirim ke pg-boss,
  tandai published_at. Konsumen didaftarkan per tipe event dan menjalankan handler di dalam
  withTenant(payload.schoolId).
- Tabel inbox_webhooks untuk webhook masuk dengan unique(provider, external_id).

Uji: transaksi yang rollback tidak menghasilkan event; worker mati di tengah tidak
menghilangkan event; replay request idempoten menghasilkan satu efek.
```

### Prompt 1.4 — Capability dan profil jenjang (PLT-07, AKD-08)

```text
Baca docs/architecture.md bagian "Profil jenjang dan capability". Ikuti kodenya sebagai acuan.

Tugas:
- packages/capabilities: katalog CAPABILITIES, LEVEL_PRESETS (sd, smp, sma, smk), MADRASAH_OVERLAY,
  resolveCapabilities(), tipe Level, CapabilityValues, BoolCapability. Tanpa I/O.
- Tabel school_capabilities (school_id, key, value jsonb, updated_by, updated_at) dan
  platform_flags (key, value, school_id nullable) untuk kill switch.
- resolveContext mengisi req.ctx.caps (cache per request). requireCap(key) mengembalikan
  404 CAPABILITY_DISABLED.
- PATCH /school/profile (level, is_madrasah) dan GET|PUT /school/capabilities untuk admin.
  Validasi: key harus ada di katalog, nilai sesuai jenisnya.
- Perubahan attendance.mode disimpan dengan effective_from = besok.
- Web: hook useCapability(key) dan komponen <IfCap name="..."> untuk menyembunyikan menu.

Uji: snapshot hasil resolveCapabilities untuk 8 kombinasi (4 jenjang x madrasah atau bukan);
override sekolah menimpa preset; kill switch menimpa override; route ber-requireCap ditolak
saat mati. Tulis rencana dulu.
```

### Prompt 1.5 — Wizard setup workspace (PLT-12)

```text
Tugas: wizard setup di apps/web (staf) untuk admin sekolah baru, 6 langkah, progres tersimpan
di server agar bisa dilanjutkan:
1. Profil sekolah: nama, NPSN atau NSM, zona waktu.
2. Jenjang: SD/MI, SMP/MTs, SMA/MA, SMK/MAK + pertanyaan "Madrasah?" (otomatis ya bila MI/MTs/MA/MAK).
   Tampilkan ringkasan fitur yang akan aktif dari resolveCapabilities sebelum disimpan.
3. Penerima MBG? (menyalakan mbg.enabled; isi jam batas dan nomor PIC bisa nanti).
4. Import data siswa: tombol ke alur import (Dapodik atau EMIS sesuai data.source); boleh dilewati.
5. Presensi gerbang: aktif atau tidak (gate.enabled).
6. Undang staf: email atau nomor WhatsApp + peran.

UI berbahasa Indonesia, ringkas, satu keputusan per layar, bisa dipakai di laptop dan HP.
Selesai bila Playwright menjalankan wizard untuk profil SD dan SMK dan capability hasilnya
sesuai preset.
```

## Fase 2: akademik, presensi, izin

### Prompt 2.1 — Data akademik dan import Dapodik (AKD-01 s.d. AKD-04, AKD-06)

```text
Baca docs/architecture.md bagian "Model data" dan "Integrasi luar".

Tugas: modul academic.
- Tabel academic_years, semesters, calendar_days (libur, hari efektif), classes (rombel, grade,
  stream nullable, homeroom_teacher_id), students (nisn, nik terenkripsi, nama, tanggal lahir),
  enrollments (student, class, academic_year, status aktif/pindah/keluar, tanggal),
  guardians + student_guardians, consents (persetujuan pemrosesan data). Semua dengan RLS.
- Import Dapodik dari berkas Excel ekspor Dapodik: unggah ke R2 lewat presigned URL ->
  job parse -> pratinjau perubahan (baru, berubah, keluar) -> commit dalam satu transaksi.
  Pencocokan: NISN, lalu NIK, lalu nama + tanggal lahir. Parser di infrastructure/importers/dapodik
  di balik interface StudentImporter supaya EMIS bisa ditambahkan nanti.
- Endpoint import mengikuti pola POST /imports/dapodik -> pratinjau, POST /imports/{id}/commit.
- UI staf: halaman Data siswa, Rombel, Import dengan tabel pratinjau yang jelas.

Pakai berkas contoh anonim di packages/db/fixtures/dapodik/ (buat sendiri sesuai kolom ekspor
Dapodik; jangan pakai data nyata). Uji: import ulang berkas sama tidak membuat duplikat;
siswa yang hilang dari berkas ditandai calon keluar, bukan dihapus.
```

### Prompt 2.2 — Jadwal dan kelompok belajar (AKD-05, fondasi AKD-10)

```text
Tugas:
- Tabel subjects, schedule_periods (jam ke-n, mulai, selesai per hari), schedule_slots dengan
  owner_type ('class' | 'group') dan owner_id, day, period, subject_id, teacher_id.
- Tabel learning_groups dan learning_group_members sudah dibuat sekarang (dipakai penuh di Fase 5).
- Validasi: guru tidak boleh di dua slot yang sama; siswa tidak boleh punya dua slot yang sama
  (lewat rombel atau kelompok).
- Import jadwal dari Excel template Absah + editor jadwal grid di web.
- Untuk sekolah dengan attendance.mode = 'daily', editor jadwal opsional: cukup wali kelas per rombel.

Uji validasi bentrok dan import template.
```

### Prompt 2.3 — Mesin sesi presensi (PRS-01 s.d. PRS-07)

```text
Baca docs/architecture.md bagian "Alur kunci > Presensi harian SD/MI" dan CLAUDE.md aturan 5.

Tugas: modul attendance.
- Tabel attendance_sessions (school_date, mode 'per_period'|'daily'|'activity'|'pkl', owner_type,
  owner_id, slot_id nullable, teacher_id, status 'open'|'submitted'|'missed'|'locked', topic,
  activity_id, pkl_placement_id, locked_at), attendance_records (session_id, enrollment_id,
  status H|S|I|A|T, source 'teacher'|'gate'|'leave'|'uks'|'pkl_confirm'|'manual', source_ref),
  daily_attendance, correction_requests.
- Domain: aturan prioritas sumber status (izin > guru > gerbang; uks dan pkl_confirm sesuai
  dokumen), fungsi murni computeDailyStatus(records).
- Job prs.generate-sessions (05.00 zona waktu sekolah, lewati hari libur, mode per_period atau
  daily sesuai capability), prs.remind-unfilled, prs.lock-sessions (23.59).
- Use case submitSession dengan pola "Semua hadir kecuali": klien mengirim daftar pengecualian
  saja; server mengisi sisanya H. Endpoint idempoten. Event attendance.absent_marked.
- Koreksi sesi terkunci lewat permintaan yang disetujui wakasek (PRS-05).
- UI staf: layar Hari ini per peran, layar isi sesi yang bisa dipakai satu tangan di HP.

Uji: 8 skenario prioritas sumber; sesi daily untuk SD; job mengikuti zona waktu Asia/Makassar
dan Asia/Jayapura; kirim dua kali tidak menggandakan record.
```

### Prompt 2.4 — Izin siswa (IZN-01 s.d. IZN-05)

```text
Tugas: modul leave.
- Tabel leave_requests (enrollment, jenis sakit/izin, rentang tanggal, alasan, lampiran R2,
  diajukan oleh, status, disetujui oleh).
- Orang tua mengajukan dari tautan aksi atau portal; wali kelas menyetujui atau menolak.
- leave.approved diproses modul attendance: isi status S/I untuk semua sesi di rentang itu,
  termasuk sesi yang dibuat setelah persetujuan.
- Notifikasi keputusan ke orang tua lewat outbox.

Uji: izin tiga hari yang disetujui sebelum sesi dibuat tetap terisi saat sesi dibuat; izin
yang dibatalkan mengembalikan status ke sumber berikutnya.
```

## Fase 3: gerbang, notifikasi, portal

### Prompt 3.1 — Kartu QR dinamis dan kios offline (GRB-01 s.d. GRB-06)

```text
Baca docs/architecture.md bagian "Stack dan topologi runtime > Aturan runtime".

Tugas: modul gate + apps/kiosk.
- Kartu digital: QR berisi token bertanda tangan (HMAC per sekolah) yang berganti tiap 30 detik,
  terikat ke perangkat pemilik (HP siswa atau HP orang tua sesuai card.holder). QR tangkapan
  layar dari perangkat lain ditolak.
- Registrasi perangkat kios dengan kode pairing sekali pakai dari admin; perangkat menyimpan
  device token; heartbeat setiap menit.
- Kios: kamera scan, umpan balik besar (hijau/kuning/merah + nama depan), suara. Scan disimpan
  dulu ke IndexedDB dengan client_event_id, lalu dikirim batch ke POST /kiosk/scans (idempoten).
  Saat offline, kios memvalidasi token dengan kunci verifikasi harian yang sudah diunduh pagi hari.
- Input manual piket dengan alasan wajib (GRB-05) dan layar piket terlambat/belum datang (GRB-06).
- Semua hanya aktif bila gate.enabled.

Uji: E2E kios offline 1 jam -> online -> semua scan masuk tepat sekali; beban k6 900 scan
dalam 20 menit; token kedaluwarsa dan token dari sekolah lain ditolak.
```

### Prompt 3.2 — Notifikasi WhatsApp (NTF-01 s.d. NTF-05)

```text
Tugas: modul notify.
- Interface MessageSender dengan implementasi FakeSender (dev/uji) dan adapter penyedia
  WhatsApp Business API (nama penyedia lewat env; jangan hardcode kredensial).
- Tabel message_templates (kode, bahasa, isi dengan placeholder, status persetujuan),
  notifications (penerima, template, payload minimum, status queued/sent/delivered/read/failed,
  provider_message_id).
- Konsumen event outbox: attendance.absent_marked, leave.approved, dll. memilih template,
  menghormati preferensi orang tua (ORT-06 nanti) dan jam tenang.
- Webhook status ke inbox_webhooks lalu memperbarui notifications.
- Retry dengan backoff; setelah 3 gagal, tandai failed dan munculkan di dasbor admin.
- Pesan hanya memuat nama depan dan status; detail lewat tautan bertoken.

Uji: event yang sama dua kali menghasilkan satu pesan; webhook status urutan acak tetap
menghasilkan status akhir benar.
```

### Prompt 3.3 — Tautan aksi, portal, dan PWA siswa (ORT-01, ORT-02)

```text
Tugas: modul portal + apps/web (portal).
- Tautan aksi bertoken (berumur 7 hari, sekali pakai untuk aksi tulis): lihat status hari ini,
  ajukan izin, tampilkan kartu anak.
- PWA siswa: login OTP, kartu QR dinamis, riwayat kehadiran sendiri. Manifest, ikon,
  service worker, bisa dipasang di Android dan iOS.
- Tampilan ramah HP murah: bundle kecil, tanpa animasi berat, teks besar.

Uji Playwright: orang tua membuka tautan aksi -> ajukan izin -> wali kelas menyetujui ->
status sesi berubah.
```

## Fase 4: rekap, MBG, billing, pilot

### Prompt 4.1 — Rekap dan ekspor (RKP-01 s.d. RKP-04)

```text
Tugas: modul report.
- Rekap S/I/A harian dan per semester dari daily_attendance, per siswa dan per rombel.
- Ekspor e-Rapor: rekap ketidakhadiran per semester dalam Excel (.xlsx, untuk diimpor ke
  e-Rapor) dan PDF (arsip bertanda tangan wali kelas dan kepala sekolah).
  Buat formatter di infrastructure/exporters/erapor di balik interface ReportExporter.
  Susunan kolom Excel mengikuti contoh di packages/db/fixtures/erapor/; tandai TODO bila kolom perlu
  dikonfirmasi dengan sekolah pilot; jangan menebak diam-diam.
- Ekspor Excel dan PDF untuk arsip; dibuat lewat tabel export_jobs + job worker, hasil di R2,
  diunduh lewat presigned URL.
- Laporan kepatuhan pengisian sesi untuk wakasek (RKP-04).

Uji: rekap dari data uji sama dengan hitungan manual di fixture; ekspor besar (900 siswa)
selesai di worker tanpa memblokir API.
```

### Prompt 4.2 — Jumlah hadir MBG (RKP-08)

```text
Baca docs/architecture.md bagian "Alur kunci > Jumlah hadir MBG".

Tugas:
- Tabel mbg_settings (cutoff_time, pic_name, pic_phone terenkripsi) dan mbg_daily_counts
  (class_id, school_date, enrolled, present_at_cutoff, forecast_h3, sent_at, superseded_by).
- Job rkp.mbg-cutoff per sekolah pada jam batasnya: hitung hadir per rombel, simpan, emit
  mbg.count_ready; NTF mengirim satu pesan ringkas ke PIC (total + per rombel).
- Koreksi setelah terkirim = baris baru yang menunjuk baris lama; tidak pernah mengubah angka terkirim.
- GET /mbg/daily?date= dan PUT /mbg/settings, dijaga requireCap('mbg.enabled').
- Kartu MBG di dasbor admin.

Uji: sekolah dengan cutoff 08.30 WIB dan 08.30 WITA menghasilkan job di waktu UTC berbeda;
siswa yang izin tidak dihitung; capability mati -> 404.
```

### Prompt 4.3 — Billing workspace (BIL-01 s.d. BIL-06)

```text
Tugas: modul subscription.
Aturan bisnis (wajib, uji semuanya):
- Rp10.000 per siswa aktif per bulan, semua fitur termasuk.
- Prorata harian berdasarkan hari kalender: siswa yang aktif 10 dari 31 hari = 10/31 x Rp10.000.
- Tagihan terbit tanggal 1 untuk bulan sebelumnya, per workspace (sekolah). Koleksi (yayasan)
  hanya menampilkan gabungan, tidak menggabungkan tagihan kecuali diatur nanti.
- Libur panjang akhir tahun ajaran tidak ditagih; libur pendek (semester, hari besar) tetap ditagih.
  Periode tidak ditagih diambil dari calendar_days bertanda billing_exempt yang hanya bisa diset
  oleh tim Absah.
- Pembulatan ke rupiah terdekat di total tagihan, bukan per siswa.
Implementasi:
- Fungsi murni computeInvoice(enrollmentDays, exemptDays, month) di domain/ dengan uji tabel.
- Tabel invoices, invoice_lines, payments; VA/QRIS lewat interface PaymentProvider + webhook ke inbox.
- Job bil.issue-invoices tanggal 1 pukul 07.00 WIB; idempoten per (school_id, bulan).

Uji: 15 kasus tabel termasuk siswa masuk tengah bulan, keluar tengah bulan, Februari kabisat,
bulan dengan libur akhir tahun sebagian.
```

### Prompt 4.4 — Data uji pilot dan ETL (persiapan go-live)

```text
Tugas A, seeder data uji di packages/db/seed/pilot.ts:
- Sekolah "SMA Absah Uji 1", level sma, zona waktu Asia/Jakarta.
- Tahun ajaran 2026/2027, semester genap mulai Januari 2027.
- 36 rombel: X-1 s.d. X-12, XI-1 s.d. XI-12, XII-1 s.d. XII-12; 25 siswa per rombel = 900 siswa,
  nama dan NISN sintetis (jangan pakai data nyata), orang tua sintetis dengan nomor uji.
- Guru, wali kelas, jadwal per jam lengkap 5 hari, beberapa kelompok mapel pilihan untuk XI dan XII.
- Deterministik (seed tetap) supaya uji E2E dan k6 stabil.

Tugas B, ETL dari repo lama project-attendance (MySQL, Laravel) di packages/db/etl/:
- Baca dump MySQL yang saya sediakan di lokasi lokal (jangan unduh apa pun), petakan ke skema
  baru, laporkan baris yang gagal dipetakan ke CSV, jalankan dalam mode dry-run dulu.
- Tidak menyalin password lama; pengguna lama diundang ulang.

Selesai bila: seeder berjalan dari nol di bawah 2 menit dan alur uji paralel kelas X-1
(11-22 Januari 2027) bisa disimulasikan di staging.
```

## Fase 5: paket jenjang P1

Jalankan setelah pilot stabil. Urutan 5.4–5.6 boleh ditukar mengikuti jenjang pelanggan berikutnya. Prompt 5.7–5.11 berisi modul P1 yang tidak bergantung jenjang dan bisa dikerjakan paralel.

### Prompt 5.1 — Jurnal mengajar, buku tamu, UKS (PRS-09, GRB-11, KSW-08)

```text
Baca docs/architecture.md bagian "Alur kunci > UKS, kegiatan, dan jurnal kebiasaan".

Tiga irisan kecil, satu PR per irisan:
1. PRS-09: field topic (maks 200 karakter, opsional) di submitSession; GET /teaching-journal
   untuk guru dan wakasek; ekspor Excel jurnal mengajar per guru per bulan.
2. GRB-11 (requireCap gate.visitors): tabel visitors; form tamu di kios (nama, instansi,
   tujuan, guru yang dituju, foto opsional); event gate.visitor_arrived -> push ke guru;
   checkout tamu oleh piket; foto dihapus otomatis 30 hari setelah keluar.
3. KSW-08 (requireCap student.uks): peran petugas_uks; tabel uks_visits dengan catatan
   terenkripsi; outcome 'dipulangkan' emit uks.sent_home -> attendance menandai sisa sesi
   hari itu S dengan source 'uks' -> NTF ke orang tua.

Uji per irisan sesuai CLAUDE.md bagian Testing expectations.
```

### Prompt 5.2 — Kanal TPPK (KSW-06, KSW-07)

```text
Baca docs/architecture.md bagian "Alur kunci > Lapor kekerasan ke TPPK" dan
"Keamanan > Kontrol untuk fitur sensitif v2". Ini fitur paling sensitif; ikuti persis.

Tugas:
- Skema Postgres tppk: reports, cases, case_events, members. RLS: hanya anggota TPPK sekolah
  itu (policy contoh di dokumen). Role dukungan Absah tidak diberi akses ke skema ini.
- POST /tppk/reports publik (tanpa login wajib), rate limited, captcha tidak dipakai; pelapor
  boleh anonim. Laporan anonim: reporter_user_id null, IP tidak disimpan di DB maupun log
  aplikasi, kode lacak acak 10 karakter ditampilkan sekali, hanya hash-nya yang disimpan.
- GET /tppk/reports/track/{code} menampilkan status saja (diterima, ditangani, selesai).
- Kronologi dan catatan kasus terenkripsi. Setiap baca dan ubah tercatat di audit_logs.
- tppk.report_received hanya memberi tahu anggota TPPK, tidak ke kepsek atau wali kelas.
- Admin menunjuk anggota TPPK (minimal 3); peringatan bila kurang.
- UI: formulir lapor yang tenang dan singkat (bisa dibuka dari QR poster), papan kasus untuk TPPK.

Uji wajib: non-anggota (termasuk admin dan kepsek) mendapat 0 baris; log aplikasi tidak memuat
IP atau isi kronologi; kode lacak salah tidak membocorkan keberadaan laporan.
```

### Prompt 5.3 — Kegiatan, buku penghubung, prakiraan MBG (KEG-01, ORT-07, RKP-09)

```text
Tiga irisan, satu PR per irisan:
1. KEG-01: modul activity; tabel activities, activity_members; peran pembina; sesi mode
   'activity' lewat use case attendance (bukan tabel presensi baru). Rekap kegiatan terpisah
   dari rekap S/I/A kelas.
2. ORT-07: communication_threads per siswa, communication_messages; peserta: orang tua, wali
   kelas, guru mapel siswa itu. Jam layanan per sekolah menahan notifikasi di luar jam.
   Tarik pesan dalam 15 menit; setelah itu permanen; pesan ditarik tetap terlihat admin.
3. RKP-09: job rkp.mbg-forecast 13.00 menghitung prakiraan H-3 = siswa aktif - izin disetujui -
   peserta kegiatan luar sekolah terjadwal; kirim ke PIC MBG.
```

### Prompt 5.4 — Paket SD dan SMP (GRB-09, GRB-10, KEG-02)

```text
Baca docs/architecture.md bagian "Alur kunci > Pulang dengan penjemput resmi".

Tugas:
- GRB-09 (requireCap gate.pickup): pickup_guardians dengan foto di R2, nomor HP terenkripsi;
  orang tua mendaftarkan, wali kelas menyetujui.
- GRB-10: alur check-out di kios: scan kartu -> tampil foto penjemput resmi -> pilih -> konfirmasi.
  Penjemput tidak terdaftar: wajib nama + foto, kios menahan sampai orang tua menyetujui lewat
  tautan aksi atau wali kelas mengizinkan. Bekerja offline dengan daftar penjemput yang
  disinkron pagi hari. Event gate.checked_out dan gate.unlisted_pickup.
- KEG-02 (habits.kaih != 'off'): habit_entries untuk 7 kebiasaan (bangun pagi, beribadah,
  berolahraga, makan sehat dan bergizi, gemar belajar, bermasyarakat, tidur cepat).
  Diisi orang tua (mode 'parent', SD) atau siswa (mode 'student'); terkunci setelah 2 hari
  (job keg.lock-habits); ringkasan mingguan untuk wali kelas.

Uji: alur emas SD dan SMP dari docs/architecture.md bagian "Pengujian".
```

### Prompt 5.5 — Paket SMA dan madrasah (AKD-09, AKD-10, AKD-11, RKP-07, KEG-03)

```text
Tugas:
- AKD-10: aktifkan learning_groups penuh (attendance.learningGroups): UI kelola kelompok,
  generate sesi milik kelompok, rekap kembali ke rombel asal, wali kelas melihat semua jam siswanya.
- AKD-11 (academic.streams): kolom classes.stream (ipa, ips, bahasa) + filter di rekap.
- AKD-09 (data.source = emis): importer EMIS sebagai implementasi kedua StudentImporter;
  alur pratinjau dan commit sama dengan Dapodik.
- RKP-07 (report.target = rdm): exporter RDM sebagai implementasi kedua ReportExporter.
  Keluaran Excel (.xlsx) dan PDF seperti e-Rapor; susunan kolom Excel mengikuti contoh di packages/db/fixtures/rdm/ yang saya sediakan,
  dan tandai feature flag rilis 'rdm-export-beta' sampai divalidasi madrasah mitra.
- KEG-03 (religious.worship / religious.memorization): sesi kegiatan jenis ibadah berjamaah;
  memorization_logs (surah atau juz, ayat awal-akhir, nilai, penyimak); peran guru tahfidz.

Uji: alur emas SMA dan MA.
```

### Prompt 5.6 — Paket SMK: PKL (PKL-01 s.d. PKL-03)

```text
Baca docs/architecture.md bagian "Alur kunci > Presensi PKL" dan contract PklCheckinBody.

Tugas: modul pkl (requireCap pkl.enabled).
- PKL-01: dudi_partners (lokasi, radius bawaan 150 m, jam kerja per hari), pkl_placements
  (siswa, DUDI, periode, guru pembimbing, pembimbing industri). Pembimbing industri diundang
  lewat WhatsApp, login OTP, akses kedaluwarsa di akhir periode.
- PKL-02: POST /pkl/checkins (Idempotency-Key wajib). Server hitung jarak (haversine), cek jam
  kerja dan selisih waktu perangkat vs server (> 10 menit = needs_review). Simpan titik dibulatkan
  4 desimal. Sesi mode 'pkl' dibuat prs.generate-sessions untuk hari kerja DUDI.
  Portal (dudi): konfirmasi batch satu klik, sanggah per siswa. Job pkl.auto-confirm tiap jam
  (24 jam tanpa sanggahan). Antrean tinjauan guru pembimbing. Konfirmasi menulis
  attendance_records source 'pkl_confirm'. Job pkl.missing-checkin pukul 10.00.
- PKL-03: pkl_journals harian dengan lampiran R2, review oleh pembimbing.
- Tidak ada pelacakan lokasi latar belakang; pembimbing industri tidak melihat koordinat.

Uji: alur emas SMK; check-in di luar radius -> needs_review; replay idempoten; DUDI A tidak
bisa mengonfirmasi siswa DUDI B.
```

### Prompt 5.7 — Portal orang tua penuh dan push staf (ORT-03 s.d. ORT-06, NTF-06)

```text
Tugas:
- ORT-03/04: portal orang tua (PWA) dengan login OTP WhatsApp; satu akun untuk beberapa anak,
  termasuk anak di sekolah berbeda dalam satu koleksi (pilih anak di header).
- ORT-05: riwayat kehadiran, izin, poin, dan tagihan per anak (bagian poin dan tagihan tampil
  bila modulnya aktif).
- ORT-06: tabel notification_preferences; pusat preferensi: nomor WhatsApp utama, wali kedua,
  jenis notifikasi yang diterima. NTF wajib menghormati preferensi ini.
- NTF-06: Web Push untuk staf (VAPID) dengan tabel push_subscriptions; dipakai untuk pengingat
  sesi, tamu datang, dan antrean persetujuan.

Uji: orang tua dengan dua anak di dua sekolah hanya melihat data anaknya; preferensi "tidak
kirim telat" benar-benar menahan pesan telat.
```

### Prompt 5.8 — Kesiswaan: poin, sanksi, peringatan dini, BK (KSW-01 s.d. KSW-05)

```text
Tugas: modul student-affairs.
- KSW-01: satu tabel aturan poin per sekolah (pelanggaran negatif, prestasi positif, kategori).
- KSW-02: pencatatan pelanggaran dan prestasi oleh guru, dengan bukti opsional di R2.
- KSW-03: ambang sanksi bertingkat (mis. 25, 50, 75 poin) yang memicu tugas tindak lanjut dan
  notifikasi ke orang tua lewat outbox.
- KSW-04: job ksw.early-warning 18.00: pola alpa berturut-turut, telat berulang, bolos jam
  pelajaran (hadir di gerbang tetapi alpa di sesi), dan absen PKL bila pkl.enabled.
  Fokus pola mengikuti jenjang lewat capability, bukan if level.
- KSW-05: catatan BK terenkripsi dengan status tindak lanjut; hanya guru BK dan admin yang membaca.

Uji: fungsi murni deteksi pola dengan uji tabel; catatan BK tidak terbaca wali kelas.
```

### Prompt 5.9 — Guru dan guru pengganti (GRU-01 s.d. GRU-04)

```text
Tugas: modul teacher.
- Presensi guru masuk dan pulang lewat kios (kartu guru) atau aplikasi staf.
- Izin guru dengan persetujuan wakasek; sesi guru yang izin ditandai butuh pengganti.
- Penugasan guru pengganti: wakasek atau piket memilih guru yang kosong di jam itu (sistem
  menyarankan dari jadwal); sesi pindah ke pengganti dan pengganti mendapat push.
- Laporan kehadiran guru per bulan untuk kepala sekolah.

Uji: sesi tanpa pengganti tetap muncul di layar wakasek; pengganti tidak boleh bentrok jadwal.
```

### Prompt 5.10 — Ujian dan tagihan siswa (UJN-01 s.d. UJN-03, TGH-01 s.d. TGH-04)

```text
Tugas A, modul exam:
- Kartu ujian digital di PWA siswa (QR dinamis yang sama dengan kartu harian, mode ujian).
- Status boleh ujian dari aturan yang dipilih sekolah: kehadiran minimal sekian persen dan/atau
  tagihan lunas. Daftar siswa tidak boleh ujian beserta alasannya untuk wali kelas.
- Daftar hadir ujian per ruang.

Tugas B, modul student-billing:
- Jenis tagihan (SPP, kegiatan, dll.), penerbitan massal per rombel atau angkatan, cicilan.
- Pembayaran VA/QRIS lewat interface PaymentProvider yang sama dengan billing; webhook ke inbox.
- Pengingat WhatsApp sebelum jatuh tempo; rekap pembayaran untuk bendahara.
- Tidak membangun tabungan siswa atau kas sekolah (di luar cakupan Absah).

Uji: webhook pembayaran dua kali hanya mencatat satu pembayaran; status boleh ujian berubah
saat tagihan lunas.
```

### Prompt 5.11 — Sesi offline, papan kedatangan, ekspor data (PRS-08, GRB-08, PLT-11)

```text
Tugas:
- PRS-08: guru bisa mengisi sesi saat offline di HP; tersimpan di IndexedDB dan dikirim otomatis
  saat online dengan Idempotency-Key. Bila sesi sudah terkunci saat sinkron, kiriman berubah
  menjadi correction_request, bukan ditolak diam-diam.
- GRB-08: papan kedatangan langsung untuk piket dan kepala sekolah, diperbarui setiap 5 detik
  (polling ringan atau SSE), per rombel: datang, terlambat, belum datang.
- PLT-11: ekspor seluruh data workspace (hak pindah data): job membuat ZIP berisi CSV per tabel
  dan berkas R2 milik sekolah, unduh lewat presigned URL, tercatat di audit log. Skema tppk
  hanya ikut bila yang meminta anggota TPPK.

Uji: E2E guru offline mengisi dua sesi lalu online; ekspor workspace data uji pilot selesai
di worker dan bisa dibuka.
```

## Fase 6: fitur P2

Kerjakan bila ada permintaan pelanggan. Pakai juga template fitur baru di Prompt pendukung untuk rincian tambahan.

### Prompt 6.1 — Dasbor dan rapor karakter (RKP-05, RKP-06, KEG-04)

```text
Tugas:
- RKP-05: dasbor kepala sekolah: tingkat hadir harian dan tren, sesi tidak terisi, siswa
  berisiko dari peringatan dini, angka MBG hari ini.
- RKP-06: dasbor koleksi (yayasan) lintas sekolah; agregat dihitung per sekolah di dalam
  withTenant lalu digabung, tidak pernah dengan query tanpa RLS.
- KEG-04: rapor karakter semester per siswa dalam PDF: kehadiran, poin, kebiasaan (7 KAIH atau
  ibadah), kegiatan. Diterbitkan lewat export_jobs.
```

### Prompt 6.2 — PKL lanjutan (PKL-04, PKL-05)

```text
Tugas:
- PKL-04: formulir penilaian DUDI per aspek (aspek diatur sekolah), diisi pembimbing industri
  di portal (dudi) di akhir periode; hasil Excel dan PDF.
- PKL-05: tracer study lulusan dengan status BMW (bekerja, melanjutkan, wirausaha): formulir
  untuk alumni lewat tautan WhatsApp, isian manual oleh BKK, rekap persentase BMW per angkatan
  dan jurusan, ekspor Excel.
```

### Prompt 6.3 — Platform dan integrasi lanjutan (PLT-08, PLT-09, PLT-14, AKD-07, GRB-07)

```text
Kerjakan sebagai PR terpisah per butir:
- PLT-08: changelog dalam aplikasi (berkas Markdown per rilis, tampil sekali per pengguna).
- PLT-09: API terbuka untuk pihak ketiga: API key per sekolah dengan scope, rate limit per key,
  webhook keluar bertanda tangan HMAC untuk event terpilih, dokumentasi dari OpenAPI.
- PLT-14: PWA berlabel yayasan: nama, logo, warna, dan domain sendiri per koleksi; manifest
  dibangkitkan dinamis; domain kustom lewat Cloudflare.
- AKD-07: sinkron Dapodik otomatis hanya bila akses resmi tersedia; di balik StudentImporter
  yang sama, jadwal mingguan, tetap dengan pratinjau sebelum commit.
- GRB-07: dukungan Kios Pro dan palang pintu: protokol perangkat di balik interface GateDevice,
  palang terbuka hanya untuk scan sah, mode darurat terbuka.
```

## Prompt pendukung

### Template fitur baru

```text
Baca CLAUDE.md dan docs/architecture.md bagian <nama bagian>.

Fitur: <KODE> — <nama fitur>. Modul: <modul>. Capability: <key atau "tidak ada">.
Peran yang boleh: <peran>.
Perilaku: <2-5 kalimat, termasuk apa yang terjadi saat gagal>.
Data: <tabel baru/berubah>.
Event: <event yang dikirim/diterima>.

Kerjakan sebagai irisan vertikal: migrasi + RLS -> domain + uji -> use case -> contract Zod ->
route -> UI -> uji API dan E2E. Tulis rencana dulu dan tunggu persetujuan.
Selesai bila: <kriteria yang bisa diuji>, dan pnpm turbo lint typecheck test hijau.
```

### Review PR sebelum merge

```text
Tinjau diff branch ini terhadap main sebagai reviewer senior. Jangan ubah kode dulu.
Periksa dan laporkan per temuan (file:baris, masalah, usulan perbaikan, tingkat: blocker/penting/kecil):
1. Tabel tenant baru tanpa school_id, indeks, atau RLS; query di luar withTenant.
2. Efek samping (WhatsApp, payment) dipanggil langsung dari handler, bukan outbox.
3. Endpoint tulis tanpa idempotensi, tanpa contract Zod, tanpa cek peran atau capability.
4. Cabang kode berdasarkan jenjang (if level ===) alih-alih capability.
5. Data pribadi masuk log, atau kolom sensitif tidak terenkripsi.
6. Impor lintas modul yang melanggar aturan dependency-cruiser.
7. Uji yang hilang menurut CLAUDE.md bagian Testing expectations.
8. Zona waktu: penggunaan new Date() untuk tanggal sekolah tanpa school timezone.
Setelah saya memilih temuan yang mau diperbaiki, perbaiki satu per satu dengan uji.
```

### Perbaikan bug

```text
Bug: <apa yang terjadi> — seharusnya <apa yang diharapkan>.
Langkah reproduksi: <langkah>. Sekolah/profil: <jenjang, capability terkait>. Log/requestId: <bila ada>.

Pertama tulis uji yang gagal dan mereproduksi bug ini. Jelaskan akar masalahnya sebelum
mengubah kode. Perbaiki seminimal mungkin, pastikan uji baru dan semua uji lama hijau.
Bila akar masalah ada di aturan dokumen arsitektur, beri tahu saya alih-alih menambal diam-diam.
```

### Audit keamanan berkala

```text
Lakukan audit keamanan read-only pada repo ini, fokus pada: isolasi tenant (RLS dan withTenant),
skema tppk, endpoint publik (POST /tppk/reports, tautan aksi, kiosk), token QR kartu, OTP,
webhook masuk (verifikasi tanda tangan, idempotensi), URL presigned R2 (masa berlaku, cakupan),
redaksi log, dan dependensi dengan kerentanan diketahui (pnpm audit).
Buat laporan di docs/security-audit-<tanggal>.md berisi temuan, bukti, dan usulan, diurutkan
dari yang paling berisiko. Jangan mengubah kode dalam sesi ini.
```

### Sinkron dokumen setelah perubahan desain

```text
Kita baru memutuskan: <keputusan>. Perbarui docs/architecture.md (bagian yang relevan saja) dan
CLAUDE.md bila aturannya berubah. Tunjukkan diff dokumen, jangan ubah kode aplikasi.
```

### Persiapan rilis

```text
Siapkan rilis <nama rilis, mis. P1b>. Periksa: semua migrasi bisa dijalankan maju dari produksi
saat ini (pakai branch Neon dari produksi bila tersedia), capability baru mati secara bawaan
kecuali preset jenjang, template WhatsApp baru tercantum di docs/whatsapp-templates.md untuk
pengajuan persetujuan, dan changelog dalam aplikasi (PLT-08) berisi ringkasan berbahasa
Indonesia untuk sekolah. Buat docs/releases/<nama>.md berisi langkah rilis dan rollback.
```

## Checklist per PR

Centang sebelum merge. Prompt 0.3 menyalin daftar ini ke template PR di repo.

**Data dan keamanan**

- [ ] Setiap tabel tenant baru punya `school_id`, indeks berawalan `school_id`, dan RLS; `db:check-rls` lulus.
- [ ] Semua query lewat `withTenant`; tidak ada role atau koneksi yang melewati RLS.
- [ ] Kolom sensitif terenkripsi; tidak ada nama, nomor HP, NISN, atau NIK di log.
- [ ] Berkas di R2 memakai kunci `schools/{school_id}/...` dan hanya diakses lewat URL presigned.

**Perilaku**

- [ ] Endpoint tulis idempoten; kios, PKL check-in, dan pembayaran mewajibkan `Idempotency-Key`.
- [ ] Efek samping lewat outbox, bukan dipanggil dari handler.
- [ ] Fitur paket jenjang dijaga `requireCap` di server dan `<IfCap>` di web; tidak ada `if (level === ...)`.
- [ ] Presensi baru memakai mesin sesi yang sama (`attendance_sessions`, `attendance_records`).
- [ ] Tanggal sekolah dihitung dengan zona waktu sekolah.

**Kualitas**

- [ ] `pnpm turbo lint typecheck test` hijau; tidak ada `any`, `ts-ignore`, atau uji yang dimatikan.
- [ ] Uji API mencakup: berhasil, validasi gagal, peran salah, capability mati, replay idempoten.
- [ ] Diff OpenAPI sesuai perubahan contract yang disengaja.
- [ ] Diff di bawah ±600 baris (tanpa berkas hasil generate) atau sudah dipecah.

**Produk**

- [ ] Teks UI berbahasa Indonesia, singkat, dan sudah dicoba di layar HP.
- [ ] Template WhatsApp baru dicatat untuk pengajuan persetujuan.
- [ ] `docs/architecture.md` dan `CLAUDE.md` diperbarui bila desain atau aturan berubah.
