# Absah — Arsitektur Teknis v2

Nov 16, 2026 · @Surya Rafliansyah

## Ringkasan

Dokumen ini adalah acuan teknis untuk membangun Absah setelah pembaruan fitur dari riset kompetitor dan kebutuhan per jenjang. Isinya menjawab tiga pertanyaan untuk engineer: **komponen apa yang dibangun, bagaimana data dan alurnya, dan dalam urutan apa**. Alasan bisnis tiap fitur ada di [Riset Kompetitor Lanjutan & Fitur per Jenjang](https://claude.ai/artifact/VhT2nLhnPJQVD5po7sV1bd); daftar fitur lengkap ada di [Dokumen Arsitektur Sistem](https://claude.ai/artifact/LaZccyrcKGvTabCZLPZTab).

**Yang berubah dibanding v1**

| Aspek | v1 | v2 |
| --- | --- | --- |
| Fitur | 81 (46 P0, 28 P1, 7 P2) | 106 (48 P0, 47 P1, 11 P2) |
| Modul | 12 domain + platform | 14 domain + platform; baru: **KEG** Kegiatan & Pembiasaan, **PKL** Praktik Kerja Lapangan |
| Variasi sekolah | Satu perilaku untuk semua | **Profil jenjang** (SD/MI, SMP/MTs, SMA/MA, SMK/MAK) + lapis madrasah, diterjemahkan ke feature flag dan pengaturan bawaan |
| Unit sesi | Sesi per jam per rombel | Sesi milik rombel **atau** kelompok belajar; mode `per_period`, `daily`, `activity`, `pkl` |
| Integrasi pemerintah | Dapodik, e-Rapor | + EMIS (import), RDM (ekspor), angka hadir MBG |
| Data sangat sensitif | Catatan BK | + laporan TPPK (skema terisolasi), foto penjemput, lokasi PKL |

**Prinsip yang tidak berubah**

1. **Satu mesin sesi.** Presensi kelas, harian SD, kegiatan, dan PKL semuanya baris di `attendance_sessions` dan `attendance_records`. Rekap, penguncian, dan koreksi ditulis sekali.
2. **Tidak ada cabang kode per jenjang.** Kode membaca *capability* (misalnya `pickup.enabled`), bukan `if (level === 'SD')`. Jenjang hanya menentukan nilai bawaan capability.
3. **Tenant terisolasi di database.** Setiap query berjalan di dalam `withTenant(schoolId)` dengan Row-Level Security Postgres.
4. **Aksi tulis aman diulang.** Header `Idempotency-Key` dan outbox transaksional untuk setiap efek samping (WhatsApp, job, webhook).
5. **Ringkas.** Absah tidak membangun LMS, CBT, PPDB, nilai, atau akuntansi; ia mengekspor ke sistem yang sudah ada.

## Stack dan topologi runtime

| Lapis | Pilihan | Catatan |
| --- | --- | --- |
| Bahasa dan repo | TypeScript strict, pnpm workspace + Turborepo | Satu repo untuk web, kios, server, dan paket bersama |
| Frontend staf dan portal | Next.js 16 App Router, React Server Components | Route group `(staf)` dan `(portal)`; portal dipasang sebagai PWA |
| Kios | Next.js static export | Berjalan offline; antrean scan di IndexedDB, sinkron saat online |
| Backend | Express 5 | Dua entrypoint dari kode yang sama: `http.ts` (API) dan `worker.ts` (job) |
| Kontrak | Zod di `packages/contracts`, dibangkitkan ke OpenAPI | Klien web dan kios memakai tipe yang sama dengan server |
| Database | Neon Postgres, region `aws-ap-southeast-1` | Drizzle ORM; RLS per sekolah; pooler mode transaksi |
| Antrean job | pg-boss di Postgres yang sama | Tanpa Redis; outbox transaksional |
| Auth | Better Auth | Sesi cookie, 2FA admin, OTP WhatsApp untuk orang tua |
| Penyimpanan berkas | Cloudflare R2, bucket privat, location hint `apac` | Unggah dan unduh hanya lewat URL presigned berumur pendek |
| Edge | Cloudflare DNS, WAF, rate limiting | Batas khusus untuk `/api/auth/*`, endpoint kios, dan kanal lapor TPPK |

&#91;embedded content: Topologi runtime Absah\]

**Aturan runtime**

- API stateless; bisa diskalakan horizontal. Semua state di Postgres atau R2.
- Worker adalah satu-satunya proses yang memanggil layanan luar (WhatsApp, email, payment gateway untuk pembuatan VA). API hanya menulis `outbox_events` dalam transaksi yang sama dengan perubahan data.
- Webhook masuk (payment, status WhatsApp) diterima API, diverifikasi tanda tangannya, disimpan ke tabel inbox dengan kunci unik dari penyedia, lalu diproses worker.
- Kios tidak pernah menulis langsung; ia mengirim batch scan bertanda `client_event_id` ke `POST /api/v1/kiosk/scans`, yang idempoten.

## Struktur monorepo dan anatomi modul

```text
absah/
├─ apps/
│  ├─ web/            Next.js: app/(staf), app/(portal), app/(dudi)
│  ├─ kiosk/          Next.js static export, service worker, IndexedDB queue
│  └─ server/
│     ├─ src/entrypoints/http.ts     Express app, router /api/v1
│     ├─ src/entrypoints/worker.ts   pg-boss workers, cron, outbox relay
│     ├─ src/modules/                satu folder per modul (lihat di bawah)
│     └─ src/shared/                 tenant, auth, capability, idempotency, outbox, errors
├─ packages/
│  ├─ contracts/      Zod schema per endpoint + generator OpenAPI
│  ├─ db/             Drizzle schema, migrasi SQL, kebijakan RLS, seeder, ETL MySQL
│  ├─ capabilities/   katalog capability + preset profil jenjang (dipakai server dan web)
│  ├─ ui/             design system Absah (komponen, token)
│  └─ config/         tsconfig, eslint, dependency-cruiser, vitest preset
└─ turbo.json, pnpm-workspace.yaml
```

`packages/capabilities` adalah paket baru di v2. Ia berisi daftar capability dan preset per jenjang sebagai data murni tanpa I/O, sehingga web bisa menyembunyikan menu dan server bisa menolak request dengan aturan yang sama.

**Anatomi satu modul** (contoh `apps/server/src/modules/pkl`)

```text
pkl/
├─ domain/          entitas, value object, aturan murni (tanpa import DB atau Express)
├─ application/     use case: placePkl, recordPklCheckIn, confirmPklDay, submitJournal
├─ infrastructure/  repository Drizzle, adapter (mis. geocoder)
├─ http/            router Express, memetakan contract Zod ke use case
├─ jobs/            handler pg-boss milik modul ini
└─ index.ts         API publik modul: use case + event yang boleh dipakai modul lain
```

**Aturan antarmodul** (dicek dependency-cruiser di CI)

- Modul hanya mengimpor `index.ts` modul lain, tidak pernah `domain/` atau `infrastructure/` milik modul lain.
- `domain/` tidak boleh mengimpor apa pun di luar `domain/` dan `packages/contracts` tipe murni.
- Komunikasi yang tidak harus sinkron memakai event outbox, bukan panggilan langsung. Contoh: `leave.approved` dari IZN diproses PRS untuk mengubah status sesi.
- Modul baru KEG dan PKL **tidak** punya tabel presensi sendiri; keduanya memanggil use case `prs.openSession` dan `prs.recordMark` dengan `mode` yang sesuai.

**Daftar modul server**

| Folder | Modul | Bergantung pada |
| --- | --- | --- |
| `platform` | PLT: auth, workspace, peran, audit, flag, setup | – |
| `academic` | AKD: sekolah, profil jenjang, rombel, kelompok belajar, jadwal, import | platform |
| `attendance` | PRS: sesi, tanda, kunci, koreksi, jurnal mengajar | academic |
| `gate` | GRB: kartu, kios, piket, penjemput, tamu | attendance |
| `leave` | IZN: izin siswa | attendance (lewat event) |
| `notify` | NTF: template, pengiriman, preferensi | – (dipanggil lewat outbox) |
| `portal` | ORT: tautan aksi, buku penghubung | academic, leave |
| `report` | RKP: rekap, ekspor, MBG | attendance, academic |
| `student-affairs` | KSW: poin, peringatan, BK, TPPK, UKS | attendance |
| `activity` | KEG: kegiatan, 7 KAIH, ibadah, hafalan, rapor karakter | attendance, student-affairs |
| `pkl` | PKL: penempatan, presensi, jurnal, penilaian, tracer | attendance, academic |
| `teacher` | GRU: presensi dan izin guru, pengganti | attendance |
| `exam` | UJN: kartu ujian, status boleh ujian | report |
| `student-billing` | TGH: tagihan siswa | academic |
| `subscription` | BIL: tagihan Absah ke sekolah | academic |

## Profil jenjang dan capability

Profil jenjang disimpan di dua kolom `schools`: `level` (`sd`, `smp`, `sma`, `smk`) dan `is_madrasah` (boolean, otomatis `true` untuk MI, MTs, MA, MAK). Kode aplikasi tidak pernah membaca dua kolom itu secara langsung. Yang dibaca adalah **capability** hasil resolusi.

**Urutan resolusi** (lapisan belakang menimpa yang depan)

1. Bawaan global: semua capability inti menyala, semua paket jenjang mati.
2. Preset jenjang dari `level`.
3. Lapis madrasah bila `is_madrasah`.
4. Override sekolah dari tabel `school_capabilities` (diubah admin sekolah di Pengaturan).
5. Kill switch platform dari `platform_flags` (dipakai tim Absah saat insiden atau rollout bertahap).

Hasilnya di-cache per request di `req.ctx.caps` dan dikirim ke web lewat `GET /api/v1/me/context`, sehingga menu yang tidak relevan tidak pernah dirender.

```ts
// packages/capabilities/src/catalog.ts
export const CAPABILITIES = {
  'attendance.mode':        { kind: 'enum', values: ['per_period', 'daily'], default: 'per_period' },
  'attendance.learningGroups': { kind: 'bool', default: false },
  'gate.enabled':           { kind: 'bool', default: false },
  'gate.pickup':            { kind: 'bool', default: false },
  'gate.visitors':          { kind: 'bool', default: true },
  'card.holder':            { kind: 'enum', values: ['student', 'parent'], default: 'student' },
  'habits.kaih':            { kind: 'enum', values: ['off', 'parent', 'student'], default: 'off' },
  'religious.worship':      { kind: 'bool', default: false },
  'religious.memorization': { kind: 'bool', default: false },
  'academic.streams':       { kind: 'bool', default: false },
  'pkl.enabled':            { kind: 'bool', default: false },
  'pkl.tracer':             { kind: 'bool', default: false },
  'mbg.enabled':            { kind: 'bool', default: false },
  'student.tppk':           { kind: 'bool', default: true },
  'student.uks':            { kind: 'bool', default: true },
  'data.source':            { kind: 'enum', values: ['dapodik', 'emis'], default: 'dapodik' },
  'report.target':          { kind: 'enum', values: ['erapor', 'rdm'], default: 'erapor' },
} as const;

// packages/capabilities/src/presets.ts
export const LEVEL_PRESETS = {
  sd:  { 'attendance.mode': 'daily', 'card.holder': 'parent', 'gate.pickup': true, 'habits.kaih': 'parent' },
  smp: { 'habits.kaih': 'student' },
  sma: { 'attendance.learningGroups': true, 'academic.streams': true },
  smk: { 'attendance.learningGroups': true, 'pkl.enabled': true, 'pkl.tracer': true },
} satisfies Record<Level, Partial<CapabilityValues>>;

export const MADRASAH_OVERLAY = {
  'data.source': 'emis', 'report.target': 'rdm',
  'religious.worship': true, 'religious.memorization': true,
} satisfies Partial<CapabilityValues>;

export function resolveCapabilities(input: {
  level: Level; isMadrasah: boolean;
  overrides: Partial<CapabilityValues>; killSwitches: Partial<CapabilityValues>;
}): CapabilityValues {
  return {
    ...defaults(),
    ...LEVEL_PRESETS[input.level],
    ...(input.isMadrasah ? MADRASAH_OVERLAY : {}),
    ...input.overrides,
    ...input.killSwitches,
  };
}
```

```ts
// apps/server/src/shared/capability.ts
export const requireCap = (key: BoolCapability) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.ctx.caps[key] ? next() : next(new CapabilityDisabledError(key)); // 404 + kode CAPABILITY_DISABLED

// pemakaian
router.post('/pickup/checkout', requireCap('gate.pickup'), handler(checkoutWithPickup));
```

**Aturan**

- Mematikan capability **tidak menghapus data**. Data tetap ada dan muncul lagi bila dinyalakan.
- Mengganti `attendance.mode` hanya berlaku mulai hari berikutnya; sesi yang sudah dibuat hari ini tidak diubah.
- Mengganti `level` (misalnya salah pilih saat setup) memicu ulang preset, tetapi override sekolah tetap dipertahankan. Wizard menampilkan ringkasan perubahan sebelum disimpan.
- `mbg.enabled` mati secara bawaan dan dinyalakan di wizard setup bila sekolah menjawab "penerima MBG", karena tidak semua sekolah menerima MBG.
- Uji unit wajib memeriksa matriks lengkap: 4 jenjang × madrasah atau bukan = 8 kombinasi, masing-masing dengan snapshot capability.

## Model data

Semua tabel tenant punya kolom `school_id uuid not null`, indeks yang diawali `school_id`, dan kebijakan RLS. Kunci utama memakai UUIDv7 (terurut waktu). Waktu disimpan `timestamptz` UTC; tanggal sekolah (`school_date date`) dihitung di zona waktu sekolah dan disimpan terpisah agar rekap harian tidak bergeser.

### Tabel inti (tetap dari v1, dengan perubahan)

| Tabel | Kolom penting | Perubahan v2 |
| --- | --- | --- |
| `schools` | `collection_id`, `timezone`, `npsn`, `nsm` | + `level`, `is_madrasah`, `nsm` untuk madrasah |
| `school_capabilities` | `key`, `value jsonb`, `updated_by` | Baru: override capability per sekolah |
| `classes` (rombel) | `academic_year_id`, `grade`, `homeroom_teacher_id` | + `stream` (`ipa`, `ips`, `bahasa`, null) |
| `learning_groups` | `academic_year_id`, `subject_id`, `teacher_id`, `name` | Baru: kelompok mapel pilihan lintas rombel |
| `learning_group_members` | `learning_group_id`, `enrollment_id` | Baru |
| `schedule_slots` | `owner_type` (`class`/`group`), `owner_id`, `day`, `period`, `subject_id`, `teacher_id` | `owner_type` menggantikan `class_id` |
| `attendance_sessions` | `school_date`, `mode`, `owner_type`, `owner_id`, `status`, `locked_at`, `topic` | + `mode` (`per_period`, `daily`, `activity`, `pkl`), `owner_type`, `topic` (jurnal mengajar), `activity_id`, `pkl_placement_id` |
| `attendance_records` | `session_id`, `enrollment_id`, `status` (H/S/I/A/T), `source`, `source_ref` | + sumber `uks`, `pkl_confirm` |
| `daily_attendance` | `enrollment_id`, `school_date`, `status`, `computed_at` | Rekap S/I/A per hari; tetap satu baris per siswa per hari |

### Tabel baru per modul

| Modul | Tabel | Isi |
| --- | --- | --- |
| GRB | `pickup_guardians` | Penjemput resmi: nama, hubungan, nomor HP, `photo_key` (R2), `valid_until`, `status` |
| GRB | `pickup_events` | Check-out pulang: siswa, penjemput (atau `unlisted_name` + foto), perangkat, petugas, waktu |
| GRB | `visitors` | Tamu: nama, instansi, tujuan, guru yang dituju, masuk, keluar |
| ORT | `communication_threads`, `communication_messages` | Buku penghubung per siswa; pesan dengan `sender_role`, `read_at` |
| RKP | `mbg_daily_counts` | Per rombel per hari: `enrolled`, `present_at_cutoff`, `forecast_h3`, `sent_at` |
| RKP | `export_jobs` | Ekspor e-Rapor/RDM/Excel: status, `file_key`, parameter |
| KSW | `uks_visits` | Keluhan, tindakan, `outcome` (`kembali_kelas`, `istirahat`, `dipulangkan`), petugas |
| KSW | `tppk.reports` | Laporan kekerasan: kategori, kronologi terenkripsi, `is_anonymous`, `reporter_user_id` (null bila anonim), `tracking_code_hash` |
| KSW | `tppk.cases`, `tppk.case_events`, `tppk.members` | Penanganan kasus, langkah, dan anggota TPPK sekolah |
| KEG | `activities` | Ekskul, upacara, ibadah: jenis, pembina, jadwal, peserta (`activity_members`) |
| KEG | `habit_entries` | Jurnal kebiasaan: `enrollment_id`, `school_date`, `habit` (7 KAIH atau ibadah), `value`, `filled_by` |
| KEG | `memorization_logs` | Setoran hafalan: surah/juz, ayat awal-akhir, nilai, penyimak |
| PKL | `dudi_partners` | Industri mitra: nama, alamat, `geo_point`, radius, jam kerja |
| PKL | `pkl_placements` | Siswa, DUDI, periode, pembimbing sekolah, pembimbing industri (`industry_mentor_id`) |
| PKL | `pkl_checkins` | Check-in/out: waktu, lokasi, akurasi, `distance_m`, foto opsional, `confirm_status` |
| PKL | `pkl_journals` | Jurnal harian: kegiatan, kompetensi, lampiran, status review |
| PKL | `pkl_assessments` | Penilaian DUDI per aspek |
| PKL | `alumni_tracer` | Lulusan: status BMW, instansi, tanggal survei, sumber |

### Isolasi tenant dan data sensitif

```sql
-- pola untuk semua tabel tenant
alter table attendance_records enable row level security;
create policy tenant_isolation on attendance_records
  using (school_id = current_setting('app.school_id')::uuid)
  with check (school_id = current_setting('app.school_id')::uuid);

-- TPPK: skema terpisah, hanya anggota TPPK sekolah itu
create policy tppk_members_only on tppk.cases
  using (
    school_id = current_setting('app.school_id')::uuid
    and exists (select 1 from tppk.members m
                where m.school_id = cases.school_id
                  and m.user_id = current_setting('app.user_id')::uuid)
  );
```

- `withTenant` men-set `app.school_id` dan `app.user_id` dengan `set_config(..., true)` di awal transaksi, aman untuk pooler Neon mode transaksi.
- Role database aplikasi tidak punya `BYPASSRLS`. Hanya job migrasi dan ETL yang memakai role terpisah.
- Kolom terenkripsi di level aplikasi (AES-256-GCM, kunci per lingkungan): kronologi TPPK, catatan BK, catatan UKS, nomor HP penjemput.
- Foto penjemput dan lampiran PKL disimpan di R2 dengan kunci `schools/{school_id}/{modul}/{uuid}`; hanya diakses lewat URL presigned 5 menit.
- Lokasi PKL disimpan sebagai jarak ke DUDI dan titik dibulatkan ke 4 desimal (sekitar 11 m), cukup untuk verifikasi tanpa menyimpan jejak presisi.

## Alur kunci fitur baru

Semua alur di bawah berakhir di tabel `attendance_records` atau tabel modulnya sendiri, lalu memicu event outbox. Notifikasi selalu dikirim worker.

### Presensi harian SD/MI (`attendance.mode = daily`)

1. Job `prs.generate-sessions` pukul 05.00 waktu sekolah membuat **satu** sesi `daily` per rombel, milik wali kelas, bukan satu sesi per jam.
2. Guru kelas membuka layar Hari ini, menekan "Semua hadir kecuali…", menandai pengecualian, lalu kirim. Izin yang sudah disetujui sudah terisi otomatis.
3. Status sesi harian langsung menjadi status hari itu di `daily_attendance`. Siswa yang ditandai alpa memicu `attendance.absent_marked`, dan orang tua diberi tahu.
4. Bila gerbang aktif, scan pagi mengisi status lebih dulu; guru hanya mengoreksi.

### Pulang dengan penjemput resmi (`gate.pickup`)

1. Orang tua mendaftarkan penjemput dari portal: nama, hubungan, nomor HP, foto. Wali kelas atau admin menyetujui (`pickup_guardians.status = approved`).
2. Saat pulang, petugas di kios memindai kartu siswa. Kios menampilkan foto semua penjemput resmi siswa itu.
3. Petugas memilih penjemput yang hadir lalu konfirmasi; `pickup_events` tercatat dan orang tua menerima WhatsApp "Ani dijemput oleh Pak Budi, 13.05".
4. Bila penjemput tidak terdaftar, petugas wajib mengisi nama dan mengambil foto; kios menahan check-out sampai orang tua menyetujui lewat tautan aksi atau wali kelas mengizinkan.
5. Saat offline, kios menyimpan check-out ke antrean dan memakai salinan daftar penjemput yang tersinkron pagi itu.

### Mapel pilihan dan *moving class* (`attendance.learningGroups`)

1. Admin membuat `learning_groups` (mis. "Biologi XI-B, kelompok 2") dan memasukkan siswa dari beberapa rombel.
2. Slot jadwal milik kelompok membuat sesi milik kelompok; guru mapel mengisi seperti biasa.
3. Rekap selalu dikembalikan ke `enrollment_id`, sehingga wali kelas rombel asal melihat semua jam siswanya, termasuk yang di kelompok lain.
4. Validasi jadwal menolak bila satu siswa masuk dua kelompok pada slot yang sama.

### Presensi PKL (`pkl.enabled`)

&#91;embedded content: Alur presensi PKL · 4 langkah, 1 keputusan\]

1. Siswa check-in dari PWA. Server menghitung jarak ke `dudi_partners.geo_point` dan mencocokkan dengan jam kerja DUDI.
2. Check-in yang sesuai menunggu konfirmasi pembimbing industri di portal DUDI (login OTP WhatsApp, tanpa akun penuh). Satu klik bisa mengonfirmasi semua siswa di tempatnya hari itu.
3. Job `pkl.auto-confirm` setiap jam mengonfirmasi check-in yang lewat 24 jam tanpa sanggahan.
4. Check-in yang tidak sesuai, atau yang disanggah, masuk antrean guru pembimbing sekolah; keputusannya menulis `attendance_records` dengan `source = pkl_confirm`.
5. Sesi PKL bermode `pkl`, satu per siswa per hari kerja DUDI, jadi rekap S/I/A tetap satu jalur.

### Jumlah hadir MBG (`mbg.enabled`)

1. Sekolah mengatur jam batas (mis. 08.30) dan nomor PIC MBG.
2. Job `rkp.mbg-cutoff` pada jam batas menghitung hadir per rombel dari `daily_attendance`, menyimpan ke `mbg_daily_counts`, dan mengirim satu pesan ringkas ke PIC.
3. Job `rkp.mbg-forecast` setiap hari menghitung prakiraan H-3: jumlah siswa aktif dikurangi izin yang sudah disetujui dan kegiatan luar sekolah terjadwal, lalu mengirimnya ke PIC.
4. Angka yang dikirim tidak berubah setelah terkirim; koreksi dicatat sebagai baris baru supaya ada jejak.

### Lapor kekerasan ke TPPK (`student.tppk`)

1. Siswa, orang tua, atau guru membuka formulir lapor dari portal atau dari QR di poster sekolah. Pelapor memilih anonim atau tidak.
2. Laporan anonim mendapat kode lacak; server hanya menyimpan hash kode itu. Pelapor bisa memantau status dengan kode tersebut.
3. Laporan masuk `tppk.reports` dan langsung memberi tahu anggota TPPK, **tidak** kepala sekolah atau wali kelas secara otomatis, untuk melindungi pelapor bila terlapor adalah staf.
4. Anggota TPPK membuat kasus, mencatat langkah, dan menutupnya. Setiap akses tercatat di audit log.

### UKS, kegiatan, dan jurnal kebiasaan

- **UKS:** petugas mencatat kunjungan. Hasil `dipulangkan` menandai sesi sisa hari itu sebagai sakit (`source = uks`) dan memberi tahu orang tua.
- **Kegiatan:** pembina membuat sesi `activity` untuk ekskul, upacara, atau ibadah berjamaah; pesertanya dari `activity_members`. Rekap kegiatan terpisah dari rekap kelas S/I/A agar e-Rapor tidak tercampur.
- **Jurnal 7 KAIH:** siswa (SMP ke atas) atau orang tua (SD) mencentang tujuh kebiasaan sekali sehari dari PWA. Wali kelas melihat ringkasan mingguan per siswa; entri yang terlambat lebih dari 2 hari dikunci.

## Kontrak API

**Konvensi**

- Basis `/api/v1`; auth di `/api/auth/*` (Better Auth). Sekolah aktif dipilih lewat header `X-School-Id` dan divalidasi terhadap keanggotaan pengguna.
- Setiap endpoint punya schema Zod di `packages/contracts/src/<modul>/*.ts`; OpenAPI dibangkitkan saat build dan dipublikasikan di `/api/v1/openapi.json`.
- Semua `POST`, `PATCH`, `DELETE` menerima `Idempotency-Key`; wajib untuk kios, PKL check-in, dan pembayaran.
- Error memakai format `{ code, message, details?, requestId }` dengan kode stabil, mis. `SESSION_LOCKED`, `CAPABILITY_DISABLED`, `PICKUP_NOT_AUTHORIZED`, `OUT_OF_GEOFENCE`.
- Daftar memakai pagination kursor (`?cursor=&limit=`), maksimum 100.

**Endpoint baru dan yang berubah di v2**

| Modul | Method dan path | Capability | Peran |
| --- | --- | --- | --- |
| PLT | `GET /me/context` | – | semua; mengembalikan sekolah, peran, dan capability |
| AKD | `PATCH /school/profile` (level, is\_madrasah) | – | admin |
| AKD | `GET\|PUT /school/capabilities` | – | admin |
| AKD | `POST /imports/emis` → pratinjau, `POST /imports/{id}/commit` | `data.source=emis` | operator |
| AKD | `GET\|POST /learning-groups`, `PUT /learning-groups/{id}/members` | `attendance.learningGroups` | operator, wakasek |
| PRS | `POST /sessions/{id}/submit` + field `topic` | – | guru |
| PRS | `GET /teaching-journal?teacherId=&from=&to=` | – | guru, wakasek |
| GRB | `GET\|POST /students/{id}/pickup-guardians`, `POST /pickup-guardians/{id}/approve` | `gate.pickup` | orang tua, wali kelas |
| GRB | `POST /kiosk/checkout` | `gate.pickup` | perangkat kios |
| GRB | `POST /kiosk/visitors`, `PATCH /visitors/{id}/leave` | `gate.visitors` | perangkat kios, piket |
| ORT | `GET /students/{id}/thread`, `POST /students/{id}/thread/messages` | – | orang tua, wali kelas, guru mapel |
| RKP | `GET /mbg/daily?date=`, `PUT /mbg/settings` | `mbg.enabled` | admin, PIC MBG |
| RKP | `POST /exports/rdm` | `report.target=rdm` | operator |
| KSW | `POST /tppk/reports` (publik, rate limited), `GET /tppk/reports/track/{code}` | `student.tppk` | siapa pun |
| KSW | `GET\|POST /tppk/cases`, `POST /tppk/cases/{id}/events` | `student.tppk` | anggota TPPK |
| KSW | `POST /uks/visits` | `student.uks` | petugas UKS |
| KEG | `GET\|POST /activities`, `POST /activities/{id}/sessions` | – | pembina |
| KEG | `PUT /habits/{studentId}/{date}` | `habits.kaih` ≠ off atau `religious.worship` | siswa, orang tua |
| KEG | `POST /memorization-logs` | `religious.memorization` | guru tahfidz |
| PKL | `GET\|POST /pkl/partners`, `GET\|POST /pkl/placements` | `pkl.enabled` | humas, kaprog |
| PKL | `POST /pkl/checkins` | `pkl.enabled` | siswa |
| PKL | `POST /pkl/checkins/confirm` (batch), `POST /pkl/checkins/{id}/dispute` | `pkl.enabled` | pembimbing industri |
| PKL | `GET\|POST /pkl/journals`, `POST /pkl/journals/{id}/review` | `pkl.enabled` | siswa, pembimbing |
| PKL | `POST /pkl/assessments`, `GET\|POST /tracer` | `pkl.enabled`, `pkl.tracer` | pembimbing industri, BKK |

**Contoh contract**

```ts
// packages/contracts/src/pkl/checkin.ts
export const PklCheckinBody = z.object({
  placementId: z.string().uuid(),
  kind: z.enum(['in', 'out']),
  capturedAt: z.string().datetime(),          // waktu di perangkat, dicek selisihnya dengan server
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().nonnegative().max(500),
  }),
  photoKey: z.string().optional(),            // dari presigned upload sebelumnya
});

export const PklCheckinResult = z.object({
  id: z.string().uuid(),
  withinGeofence: z.boolean(),
  distanceM: z.number(),
  confirmStatus: z.enum(['pending', 'needs_review']),
});
```

## Job, event, dan integrasi

### Job terjadwal (pg-boss, zona waktu per sekolah)

| Job | Jadwal | Fungsi |
| --- | --- | --- |
| `prs.generate-sessions` | 05.00 | Membuat sesi hari ini sesuai `attendance.mode`, jadwal rombel, kelompok belajar, kegiatan, dan penempatan PKL; dilewati di hari libur kalender |
| `prs.remind-unfilled` | 10 menit setelah jam pelajaran berakhir | Pengingat ke guru yang sesinya belum diisi (PRS-07) |
| `prs.lock-sessions` | 23.59 | Mengunci sesi, menandai `missed`, menghitung `daily_attendance` |
| `rkp.mbg-cutoff` | Jam batas MBG sekolah | Menghitung dan mengirim angka hadir per rombel |
| `rkp.mbg-forecast` | 13.00 | Prakiraan porsi H-3 ke PIC MBG |
| `pkl.auto-confirm` | Setiap jam | Mengonfirmasi check-in PKL yang lewat 24 jam tanpa sanggahan |
| `pkl.missing-checkin` | 10.00 hari kerja DUDI | Memberi tahu siswa dan guru pembimbing bila belum check-in |
| `keg.lock-habits` | 00.30 | Mengunci jurnal kebiasaan yang lebih dari 2 hari |
| `ksw.early-warning` | 18.00 | Menghitung pola alpa, telat, bolos jam, dan absen PKL |
| `bil.issue-invoices` | Tanggal 1, 07.00 | Menghitung siswa aktif prorata harian dan menerbitkan tagihan workspace |
| `outbox.relay` | Terus-menerus (poll 1 detik) | Memindahkan `outbox_events` ke antrean job |

### Event outbox

Nama event berbentuk `<modul>.<kejadian>`. Payload hanya memuat ID dan data minimum; konsumen membaca ulang dari DB di dalam `withTenant`.

| Event | Produsen | Konsumen |
| --- | --- | --- |
| `attendance.absent_marked` | PRS | NTF (orang tua), KSW (peringatan dini) |
| `attendance.session_locked` | PRS | RKP (rekap harian) |
| `leave.approved` | IZN | PRS (isi status), RKP (prakiraan MBG) |
| `gate.checked_out` | GRB | NTF (pesan dijemput oleh) |
| `gate.unlisted_pickup` | GRB | NTF (minta persetujuan orang tua) |
| `gate.visitor_arrived` | GRB | NTF (push ke guru yang dituju) |
| `uks.sent_home` | KSW | PRS (status sakit), NTF (orang tua) |
| `tppk.report_received` | KSW | NTF (anggota TPPK saja) |
| `pkl.checkin_recorded` | PKL | NTF (pembimbing industri, ringkasan harian) |
| `pkl.day_confirmed` | PKL | PRS (tulis `attendance_records`) |
| `thread.message_posted` | ORT | NTF (penerima, hormati jam layanan) |
| `mbg.count_ready` | RKP | NTF (PIC MBG) |

### Integrasi luar

| Sistem | Arah | Cara | Catatan |
| --- | --- | --- | --- |
| Dapodik | Masuk | Unggah berkas ekspor (Excel); sinkron otomatis bila akses resmi tersedia (AKD-07, P2) | Kunci pencocokan NISN, lalu NIK, lalu nama + tanggal lahir |
| EMIS | Masuk | Unggah berkas ekspor EMIS | Parser terpisah; pratinjau dan commit sama dengan Dapodik |
| e-Rapor | Keluar | Rekap S/I/A per semester dalam Excel (untuk diimpor ke e-Rapor) dan PDF (arsip bertanda tangan) | Susunan kolom Excel dicocokkan dengan sampel sekolah pilot |
| RDM | Keluar | Rekap ketidakhadiran per semester dalam Excel dan PDF | Susunan kolom Excel dicocokkan dengan sampel madrasah mitra sebelum rilis P1c |
| WhatsApp Business API | Keluar + webhook status | Template pesan yang disetujui; status terkirim dan dibaca masuk lewat webhook | Satu nomor pengirim Absah; nama sekolah di isi template |
| Payment gateway | Keluar + webhook | VA/QRIS untuk tagihan siswa (TGH) dan tagihan Absah (BIL) | Webhook ke inbox idempoten dengan ID transaksi penyedia |

Adapter tiap sistem luar berada di `infrastructure/` modul pemiliknya dan berada di balik interface (mis. `MessageSender`, `PaymentProvider`), sehingga uji memakai adapter palsu dan penyedia bisa diganti tanpa menyentuh use case.

## Keamanan, privasi, dan observabilitas

Absah memproses data anak, sehingga acuan utamanya adalah UU 27/2022 tentang Pelindungan Data Pribadi: dasar pemrosesan yang jelas, data minimum, dan hak orang tua atas data anaknya.

### Akses dan peran

| Peran | Cakupan | Catatan v2 |
| --- | --- | --- |
| Admin sekolah, operator | Seluruh workspace | Mengatur profil jenjang dan capability |
| Kepala sekolah, wakasek | Baca seluruh workspace | Tidak otomatis melihat kasus TPPK |
| Wali kelas | Rombelnya | + menyetujui penjemput, membaca buku penghubung rombelnya |
| Guru mapel | Sesi dan kelompok yang ia ajar | + menulis jurnal mengajar |
| Piket, petugas kios | Gerbang hari ini | + check-out penjemput, buku tamu |
| Petugas UKS | Kunjungan UKS | Peran baru |
| Anggota TPPK | Laporan dan kasus TPPK sekolahnya | Peran baru, ditunjuk admin; minimal 3 orang |
| Pembina kegiatan, guru tahfidz | Kegiatannya | Peran baru |
| Humas/kaprog, guru pembimbing PKL | Penempatan PKL | Peran baru |
| Pembimbing industri | Siswa PKL di tempatnya, selama periode PKL | Akun ringan lewat OTP WhatsApp, kedaluwarsa otomatis |
| Orang tua, siswa | Data anak atau dirinya sendiri | + jurnal kebiasaan, penjemput, buku penghubung |

Peran disimpan per sekolah dan per tahun ajaran, jadi wali kelas tahun lalu tidak otomatis membaca rombel lamanya.

### Kontrol untuk fitur sensitif v2

- **TPPK:** skema `tppk` terpisah, RLS anggota saja, kronologi terenkripsi, setiap baca dan ubah tercatat. Pelapor anonim tidak disimpan identitasnya, termasuk alamat IP (hanya dipakai rate limiter di Cloudflare, tidak masuk log aplikasi). Akses dukungan Absah (PLT-10) **tidak** mencakup skema TPPK.
- **Foto penjemput dan tamu:** hanya terlihat oleh wali kelas, piket, dan admin; dihapus otomatis 30 hari setelah penjemput dinonaktifkan atau tamu keluar.
- **Lokasi PKL:** hanya diambil saat siswa menekan check-in, tidak ada pelacakan latar belakang. Pembimbing industri melihat status, bukan koordinat.
- **Buku penghubung:** pesan bisa ditarik pengirim dalam 15 menit; setelah itu tidak bisa dihapus, dan pesan yang ditarik tetap tercatat untuk admin bila ada sengketa. Jam layanan menahan notifikasi di luar jam, bukan menahan pesannya.
- **Data anak di WhatsApp:** pesan memuat nama depan dan status saja; detail dibuka lewat tautan bertoken berumur pendek.

### Retensi bawaan

| Data | Retensi |
| --- | --- |
| Presensi, rekap, jurnal mengajar | Selama berlangganan + 5 tahun, atau dihapus atas permintaan sekolah |
| Check-in PKL (lokasi) | Sampai nilai PKL final + 1 tahun |
| Laporan dan kasus TPPK | Bawaan 5 tahun setelah kasus ditutup; bisa diubah sekolah |
| Pesan buku penghubung | 2 tahun ajaran |
| Log aplikasi | 30 hari; audit log 2 tahun |

Angka retensi di atas adalah usulan awal dan perlu ditinjau penasihat hukum sebelum rilis.

### Observabilitas

- Log JSON terstruktur dengan `requestId`, `schoolId`, `userId` (UUID, tanpa nama), modul, durasi. Data pribadi disaring redactor sebelum log keluar.
- Tracing OpenTelemetry dari API ke worker; `traceId` ikut tersimpan di `outbox_events` agar efek samping bisa dilacak sampai pesan WhatsApp.
- Metrik utama: sesi terisi tepat waktu per sekolah, latensi scan kios p95, umur antrean kios offline, kegagalan kirim WhatsApp, umur event outbox tertua, job gagal per jenis, angka MBG terkirim sebelum jam batas.
- Alarm: outbox tertua lebih dari 5 menit, kios offline lebih dari 30 menit di jam masuk, `rkp.mbg-cutoff` gagal, lonjakan error 5xx.

## Pengujian dan gerbang kualitas

| Lapis | Alat | Yang wajib diuji |
| --- | --- | --- |
| Unit domain | Vitest | Aturan murni: prioritas sumber status, prorata billing, resolusi capability (8 kombinasi jenjang × madrasah), geofence dan jam kerja PKL, hitung MBG |
| Integrasi DB | Vitest + Postgres di Docker (atau branch Neon per PR) | Repository, migrasi, **uji RLS**: query dengan `app.school_id` sekolah A tidak pernah mengembalikan baris sekolah B; non-anggota TPPK mendapat 0 baris |
| API | Supertest terhadap `http.ts` | Setiap endpoint: validasi contract, peran, capability mati → `CAPABILITY_DISABLED`, idempotensi (request sama dua kali = satu efek) |
| Job | Vitest dengan pg-boss nyata | Jadwal dan zona waktu sekolah, retry, outbox tidak hilang saat worker mati di tengah |
| Arsitektur | dependency-cruiser | Tidak ada impor lintas `domain/` atau `infrastructure/` modul lain; `domain/` bebas I/O |
| E2E | Playwright | Alur emas per jenjang (lihat di bawah) di web dan kios, termasuk kios offline lalu sinkron |
| Beban | k6 | 900 siswa scan dalam 20 menit di satu sekolah; 50 sekolah serentak di jam masuk; `prs.generate-sessions` untuk 500 sekolah selesai di bawah 10 menit |

**Alur emas E2E per profil**

- **SD:** guru kelas mengisi sesi harian → orang tua menerima WhatsApp alpa → check-out dengan penjemput resmi → penjemput tak terdaftar ditahan sampai disetujui.
- **SMP:** sesi per jam → bolos jam terdeteksi peringatan dini → siswa mengisi jurnal 7 KAIH.
- **SMA:** siswa di kelompok mapel pilihan → rekap kembali ke rombel asal → ekspor e-Rapor.
- **SMK:** check-in PKL di dalam radius → konfirmasi pembimbing industri → masuk rekap; check-in di luar radius → antrean guru pembimbing.
- **MA:** import EMIS → sesi ibadah berjamaah → setoran hafalan → ekspor RDM.
- **Semua:** laporan TPPK anonim → hanya anggota TPPK yang menerima → kode lacak menampilkan status.

**Gerbang CI** (setiap PR ke `main`)

1. `pnpm turbo lint typecheck test` hijau.
2. Migrasi berjalan maju dari nol dan dari snapshot produksi yang dianonimkan; setiap tabel tenant baru punya kebijakan RLS (dicek skrip `db:check-rls`).
3. OpenAPI yang dibangkitkan tidak berubah tanpa perubahan contract yang disengaja (diff ditampilkan di PR).
4. Cakupan uji domain modul yang berubah minimal 80%.
5. Preview: branch Neon dan deployment preview per PR untuk QA manual.

## Urutan implementasi dan rilis

Fase 0–4 adalah MVP untuk pilot SMA Absah Uji 1 (36 rombel, 900 siswa): uji paralel di X-1 pada 11–22 Januari 2027, go-live penuh 25 Januari 2027. Paket P1 dirilis setelahnya. Setiap fase selesai bila kriteria keluarnya terpenuhi, bukan bila tanggalnya tiba.

| Fase | Isi | Selesai bila |
| --- | --- | --- |
| 0. Fondasi | Monorepo, `packages/config`, `contracts`, `db`, `capabilities`; Express dengan dua entrypoint; CI; Neon dan R2 per lingkungan | `pnpm dev` menjalankan web, kios, API, worker; CI hijau; migrasi kosong jalan di branch Neon |
| 1. Platform | Better Auth, workspace dan koleksi, peran, `withTenant` + RLS, audit log, idempotensi, outbox, feature flag, **profil jenjang (AKD-08)**, wizard setup (PLT-12) | Uji RLS lintas sekolah lulus; wizard membuat sekolah dengan profil yang benar untuk 8 kombinasi |
| 2. Akademik dan presensi | Import Dapodik, rombel, jadwal, sesi `per_period` dan `daily`, isi berbasis pengecualian, kunci, koreksi, pengingat, izin | Guru mengisi satu hari penuh jadwal 36 rombel di data uji; rekap harian benar |
| 3. Gerbang, notifikasi, portal | Kartu QR dinamis, kios offline, piket, WhatsApp, tautan aksi, PWA siswa | 900 scan dalam 20 menit tanpa duplikat; kios offline 1 jam lalu sinkron tanpa kehilangan data |
| 4. Rekap dan billing | Rekap S/I/A, ekspor e-Rapor dan Excel, **jumlah hadir MBG (RKP-08)**, billing workspace prorata | Ekspor diterima e-Rapor sekolah pilot; tagihan contoh cocok dengan hitungan manual |
| Pilot | Uji paralel X-1, lalu go-live 36 rombel | Sesi terisi tepat waktu ≥ 95% selama 2 minggu; tidak ada insiden data lintas sekolah |
| P1a semua jenjang | Jurnal mengajar, buku tamu, UKS, TPPK, sesi kegiatan, prakiraan MBG, buku penghubung | Alur emas "Semua" lulus E2E |
| P1b SD dan SMP | Penjemput resmi, check-out, jurnal 7 KAIH | Alur emas SD dan SMP lulus |
| P1c SMA dan madrasah | Kelompok mapel pilihan, jurusan, import EMIS, ekspor RDM, ibadah dan hafalan | Alur emas SMA dan MA lulus; format RDM divalidasi madrasah mitra; jurusan siap sebelum TA 2027/2028 |
| P1d SMK | Penempatan, presensi, jurnal PKL | Alur emas SMK lulus dengan minimal satu DUDI nyata |
| P2 | Rapor karakter, penilaian DUDI, tracer study, PWA berlabel yayasan, Kios Pro | Sesuai permintaan pelanggan |

**Catatan urutan**

- Profil jenjang masuk Fase 1, meski paket jenjangnya baru P1, karena mode sesi `daily` dan struktur capability memengaruhi skema sejak awal. Menambahkannya belakangan berarti migrasi data sesi.
- Kolom `owner_type` di jadwal dan sesi dibuat di Fase 2, walau kelompok belajar baru aktif di P1c, untuk alasan yang sama.
- Bila sekolah pilot butuh mapel pilihan saat go-live, P1c (bagian kelompok belajar saja) dimajukan sebelum pilot.
- Urutan P1b–P1d mengikuti jenjang pelanggan berikutnya dan bisa ditukar tanpa mengubah arsitektur.
