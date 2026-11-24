# Rencana slicing UI Absah (U0)

Dokumen ini hasil audit repo untuk fase U0. Sumber prompt: dokumen "Prompt Claude Code: Slicing UI/UX Absah".
Tidak ada kode aplikasi yang diubah di PR ini. Audit dikerjakan pada `main` = 44dc37b dengan
`@absah/contracts` dan `@absah/capabilities` di absah-api 0ff5db9.

## 1. Temuan utama: repo jauh lebih maju daripada asumsi prompt

Prompt menganggap UI dibangun dari nol. Kenyataannya `apps/web` sudah punya sekitar 90 halaman fungsional
(`(staf)`, `(portal)`, `(dudi)`, `(lapor)`, `(akun)`, `(alumni)`), e2e Playwright, antrean offline, dan kios.
Yang belum ada adalah sistem desain: `packages/ui` hanya berisi `Button` dan `tokens.css`. Jadi "slicing" di repo
ini berarti **membangun sistem desain lalu memasang ulang halaman yang sudah jalan ke komponen itu**, bukan membuat
halaman baru. Dua konsekuensi:

- Setiap fase halaman (U4 sampai U8) harus menjaga perilaku dan e2e yang sudah ada tetap hijau.
- Fase yang prompt tulis sebagai "bangun" (mis. U5 antrean offline) di sini sudah ada. Lihat bagian 3.

## 2. Teknologi: bawaan prompt dibanding repo

| Hal | Bawaan prompt | Repo sekarang | Keputusan |
| --- | --- | --- | --- |
| Next.js, React | n/a | Next 16.4, React 19.3, TypeScript 6 | Pakai yang ada |
| Styling | Tailwind v4 + `@theme` | CSS modules (14 berkas `*.module.css`) + variabel `--absah-*` di `packages/ui/src/tokens.css`; `Button` memakai style inline | **Tetap CSS modules.** Prompt sendiri mengizinkan ("Ganti bila repo sudah memakai CSS modules"). U1 membuat token sebagai variabel CSS dari `tokens.json`, tanpa Tailwind. Lihat pertanyaan 1 |
| Primitif | Radix UI | Tidak ada. Dialog dan sheet belum ada; konfirmasi memakai `window.confirm` | Pasang Radix (Dialog, Popover, Tabs, Toast) di U2. Dependensi baru, alasannya ditulis di PR U2 |
| Varian komponen | cva + tailwind-merge | Tidak ada (`cx.ts` kecil) | Pakai `cva` saja. `tailwind-merge` tidak perlu tanpa Tailwind |
| Ikon | lucide-react | Tidak ada | Pasang di U2 |
| Formulir | react-hook-form + zodResolver | Tidak ada; formulir memakai state biasa dan skema dari contracts | Pasang hanya di halaman Data (U6b ke atas). Formulir lama tidak ditulis ulang |
| Data | Server Component + Server Action | Hampir semua halaman `'use client'` dan memanggil `api()` (`lib/api.ts`) lewat rewrite `/api/*`; sesi lewat cookie Better Auth | **Tetap `api()` di klien.** Server Action belum cocok dengan arsitektur auth sekarang. Lihat pertanyaan 2 |
| TanStack Query | Layar presensi | Tidak ada; `sesi/[id]` memakai state + antrean sendiri | Tidak dipasang. Lihat bagian 3 |
| State presensi | Fungsi murni + `useReducer` di `features/presensi` | Logika `initialMarks`, kirim, antre ada di `sesi/[id]/page.tsx` (272 baris) | Ikut prompt: pindahkan ke reducer murni di U4b |
| Offline | Serwist + idb + Idempotency-Key | `lib/offline-queue.ts` (IndexedDB `absah-staff-offline`), `lib/sync-sessions.ts`, `offline-sync.tsx`, `public/portal-sw.js`, Idempotency-Key per kirim | **Pakai yang ada.** Tabel prompt: "Ganti bila arsitektur offline sudah ada". Serwist tidak dipasang |
| Dokumentasi komponen | Storybook + addon a11y | Tidak ada | Pasang di U2 (devDependency, `packages/ui`) |
| Tes | Vitest + Testing Library, Playwright, axe | Vitest 5 dan Playwright 1.65 ada; Testing Library dan `@axe-core/playwright` belum | Pasang di U2 |
| Ukuran tangkapan | 390x844, 1440x900, 1180x820 | e2e proyek `laptop` (Desktop Chrome) dan `hp` (Pixel 7) | Tambah ukuran tetap di spesifikasi visual, jangan ubah proyek yang ada |
| Font | Plus Jakarta Sans lewat `next/font` | `system-ui` di `tokens.css`; font belum dipasang | U1 |
| Kios | Font lokal, tanpa framework tambahan | Static export, tanpa CSS modules, `page.module.css` saja | U1 memakai font lokal. Kios tetap tanpa pustaka UI baru |

Dependensi baru di PR ini hanya satu: `@playwright/test` ^1.65.1 sebagai devDependency akar untuk
`design/render.mjs`. Versinya sama dengan yang sudah dipakai `apps/web`, jadi lockfile hanya menambah satu tautan akar.

## 3. Pemetaan papan ke rute (repo menang atas usulan prompt)

Rute usulan prompt memakai `(staf)/guru/...` dan `(staf)/data/...`. Repo memakai rute datar. Mengganti rute berarti
memutus tautan, push, WhatsApp, dan e2e yang sudah ada, jadi **rute yang ada dipertahankan**.

| Papan | Rute usulan prompt | Rute di repo | Fase | Capability | Catatan |
| --- | --- | --- | --- | --- | --- |
| Sistem-UI | `packages/ui` + Storybook | `packages/ui` (hanya Button) | U1, U2 | semua | Dasar semua fase |
| Main (Hari ini) | `(staf)/hari-ini` | `(staf)/hari-ini` (daftar sesi guru, 114 baris) dan `(staf)/page.tsx` (beranda berisi kartu, 320 baris) | U6a | semua | Dua halaman sudah ada dengan tujuan lain. Papan Main = papan kedatangan admin. U6a memutuskan: diletakkan di `/dasbor` atau `/hari-ini` untuk peran admin. Pertanyaan 3 |
| Guru-isi-sesi, Alur-presensi | `(staf)/guru/hari-ini`, `(staf)/guru/sesi/[sesiId]` | `(staf)/hari-ini` (beranda guru, langkah 1) dan `(staf)/sesi/[id]` (isi presensi) | U4a, U4b, U5 | `attendance.mode` per jam atau harian | Menu `/hari-ini` dipakai juga oleh peran lain. U4a hanya mengganti tampilan, bukan rute |
| Setup-jenjang | `(staf)/setup/jenjang` | `(staf)/setup` (87 baris) | U8 | admin | Langkah di server sudah ada (`GET /school/setup`, `PUT /school/setup/steps/:step`, `POST /school/setup/complete`) |
| Data-siswa | `(staf)/data/siswa` | `(staf)/siswa` (+ `siswa/kontak`, `import`) | U6b | semua | |
| Data-rombel | `(staf)/data/rombel` | `(staf)/rombel` | U6c | semua | |
| Data-mapel | `(staf)/data/mapel` | belum ada; mapel hanya dipilih di `(staf)/jadwal` | U6c | semua | Halaman baru. Lihat kontrak yang belum ada |
| Data-jadwal | `(staf)/data/jadwal` | `(staf)/jadwal` (tab jadwal, jam, wali kelas, import, kelompok belajar) | U6d | mode per jam | |
| Data-guru | `(staf)/data/guru` | belum ada; `POST /school/invitations` baru dipakai langkah wizard `(staf)/setup/steps.tsx` dan e2e | U6e | semua | Halaman baru |
| Ortu-portal-sd | `(portal)/anak` | `(portal)/portal` (+ `portal/preferensi`, `kebiasaan`, `penjemput`, ...) | U7a | portal orang tua | Rute `/portal` dipakai PWA (`manifest.ts`, `portal-sw.js`). Tidak diganti |
| Siswa-pkl | `(dudi)` atau `(portal)/pkl` | `(portal)/portal/pkl` | U7b | `pkl.enabled` | `(dudi)` untuk pembimbing industri, bukan siswa |
| Lapor-tppk | `(portal)/lapor` | `(lapor)/lapor` (+ `lapor/lacak`) | U7c | `student.tppk` | Route group sendiri, tanpa login dan tanpa service worker. Dipertahankan |
| Kios-pulang | `apps/kiosk /pulang` | `apps/kiosk` satu halaman (`app/page.tsx`, 28 baris; layar di `components/`) dengan fase pairing, scan, pulang, tamu | U7d | `gate.pickup`, kios aktif | Kios bukan rute; "Pulang" adalah layar di dalam satu halaman. Tidak ada rute `/pulang` |
| Riset-UI | tidak jadi kode | n/a | U0 | n/a | Hanya dibaca |
| Tahun ajaran | belum didesain | belum ada | tidak dikerjakan | n/a | Tunggu papan |

### Komponen dan kontrak per papan

Kolom "Belum ada di kontrak" memakai `@absah/contracts` di absah-api 0ff5db9 dan daftar rute server
(`apps/server/src`). Tidak ada yang dibuat di PR ini.

| Papan | Komponen yang dibutuhkan | Kontrak dan endpoint yang sudah ada | Belum ada di kontrak |
| --- | --- | --- | --- |
| Sistem-UI | semua komponen U2a dan U2b | n/a | n/a |
| Main | StatusPill (lima kotak), Card, Table, Banner, ProgressBar, Dialog | `GET /attendance/today`, `/reports/attendance/classes`, `/reports/session-compliance`, `/leave-requests`, `/early-warnings`, `/mbg/daily`, `/dashboard/principal`, `POST /leave-requests/:id/decide` | Aksi **Ingatkan** per baris dan semua (tidak ada rute kirim pengingat guru). **Unduh rekap hari ini**: `POST /exports` sudah ada untuk rekap, tetapi belum diperiksa apakah menerima rentang satu hari (cek di U6a). Semester aktif dan "diperbarui hh.mm" (ada `GET /reports/semesters`; waktu muat bisa dari klien) |
| Guru-isi-sesi / Alur-presensi | StatusPill, Sheet, Toast, Banner, FilterChip, ProgressBar, ListRow, Button | `GET /attendance/today`, `GET /sessions/:id` (`SessionDetail`), `POST /sessions/:id/submit` dan `/sync` (`SubmitSessionRequest`, `SyncSessionRequest`), `/corrections`, izin dan scan gerbang sudah masuk `SessionStudent` | Perlu dibuktikan di U4b: apakah `SessionStudent` memuat **sumber** pengecualian ("Izin disetujui · acara keluarga", "Gerbang 06.41"). `lib/attendance.ts` punya `SOURCE_LABELS`, jadi kemungkinan ada |
| Setup-jenjang | Stepper, Field, Select, Banner | `/school/profile`, `/school/capabilities`, `/school/setup`, `PUT /school/setup/steps/:step`, `POST /school/setup/complete`, `@absah/capabilities` presets | Tidak ada yang jelas hilang. Urutan langkah papan harus dibandingkan dengan `SetupStep` di U8 |
| Data-siswa | DataPageHeader, DataToolbar, DataTable, EntityDrawer, ConfirmDialog, Field | `GET /students` (`StudentListQuery`, `StudentListItem`), `PATCH /enrollments/:id` (`status`: active, moved, left, `endsOn`), `GET/PUT /students/:id/contacts`, import Dapodik dan EMIS | **Tambah siswa** (tidak ada `POST /students`). **Ubah identitas** (nama, NISN, tanggal lahir, jenis kelamin: tidak ada `PATCH /students/:id`). **Alasan keluar** Lulus, Mengundurkan diri, Salah input: enrollment hanya mengenal moved dan left. **Ekspor Excel siswa**. **Tanggal sinkron Dapodik terakhir** |
| Data-rombel | DataTable, Tabs, Drawer, Dialog, Table | `GET /classes`, `PATCH /classes/:id` (hanya wali kelas), `/learning-groups` (+members) | **Tambah rombel** (tidak ada `POST /classes`). **Ubah** jurusan, ruang. **Kenaikan kelas** dengan pratinjau. Kolom **Ruang**. **Tahun ajaran** (tidak ada rute) |
| Data-mapel | DataTable, baris tambah di tabel, ConfirmDialog | `GET/POST /subjects`; `Subject` = `{ id, name, code }` | **Kelompok** (umum, pilihan, muatan lokal), **tingkat**, **JP per minggu**, **guru pengampu**, **Arsipkan** (tidak ada `PATCH /subjects/:id`), **Pakai daftar Kurikulum Merdeka** |
| Data-jadwal | grid jadwal, Drawer, Banner, Tabs | `GET /schedule`, `PUT /schedule/slots`, `DELETE /schedule/slots/:id` (409 `SCHEDULE_CONFLICT` + `ScheduleConflictDetail`), `/schedule/periods`, `/schedule/teachers`, import Excel | Tampilan **Per ruang** (tidak ada data ruang). Tampilan **Per guru** (belum jelas apakah `GET /schedule` bisa disaring per guru). **Terbitkan jadwal** dan "berlaku mulai": jadwal sekarang langsung berlaku saat sel disimpan, tidak ada draf. **JP per mapel terpenuhi** (butuh JP per minggu di Mapel) |
| Data-guru | DataTable, Drawer, Dialog, badge | `GET /school/members`, `POST /school/invitations`, `/invitations/preview` dan `/accept`, `GET /teacher-leaves`, peran di `platform/roles` | **Status akun** (Aktif, Menunggu, Belum diundang) dan "belum diundang" untuk PTK tanpa akun. **Ubah peran per tahun ajaran**. **Nonaktifkan staf**. **Kirim ulang undangan**. **Import PTK Dapodik** |
| Ortu-portal-sd | StatusPill, Card, Banner, tab anak | `GET /portal/attendance` (7, 30, 90, 180 hari), `GET /leave-requests`, `/cards/mine`, `/habits`, `/portal/notification-preferences`, link aksi `/t` | Teks papan "dicek Bu Endah, guru kelas, 07.05" (siapa yang memeriksa) perlu dicek di `PortalAttendance` di U7a |
| Siswa-pkl | Button besar, Banner, EmptyState | `GET /pkl/me`, `POST /pkl/checkins`, jurnal | Tidak ada yang jelas hilang. Jalur alternatif saat izin lokasi ditolak harus dibaca dari papan |
| Lapor-tppk | form bertahap, Field, Banner | `GET /tppk/channel/:schoolId`, `POST /tppk/reports`, `GET /tppk/reports/track/:code` | Tidak ada. Prompt U7c melarang pelacakan untuk pelapor, padahal `/lapor/lacak` sudah ada; yang ada dipertahankan (pertanyaan 4) |
| Kios-pulang | layar kios, hitung mundur | `GET /kiosk/day` (memuat `pickup`), `POST /kiosk/checkouts`, `/kiosk/unlisted-pickups` | Tidak ada. Jeda "kembali ke awal" harus dibaca dari papan; kios saat ini punya `CheckoutScreen` |

## 4. Urutan PR U1 sampai U9

Perkiraan berkas memakai jumlah halaman yang disentuh. "Berkas" = berkas yang berubah atau ditambah, tanpa lockfile
dan tangkapan layar. Batas PR dari CLAUDE.md: sekitar 600 baris berubah.

| Fase | Isi | Perkiraan berkas | Risiko utama |
| --- | --- | --- | --- |
| U1 | `tokens:build` dari `tokens.json` ke `tokens.ts` dan `tokens.css`; Plus Jakarta Sans (`next/font` di web, font lokal di kios); pemeriksaan kontras otomatis | 8 sampai 12 | Nama variabel `--absah-*` sekarang dipakai 14 berkas CSS dan `Button`. Mengganti nama memutus semuanya. Pertahankan alias lama sampai fase halaman. Warna `tokens.json` (papan `#1E5B4B`) berbeda dari `tokens.css` sekarang (`#0f7a4f`), jadi tampilan seluruh aplikasi bergeser |
| U2a | Button (varian dan tinggi), IconButton, Field/Input/Textarea/Select, FilterChip, StatusPill, Banner, Toast, ProgressBar; Storybook; Radix; lucide; Testing Library; axe | 35 sampai 50 | Terbesar dan paling lama. Dependensi baru terbanyak. Storybook dengan Next 16 dan React 19 belum diuji. `Button` dipakai halaman lama; API-nya tidak boleh patah |
| U2b | Sheet, Dialog, Drawer, Card, ListRow, Table, EmptyState, ErrorState, Skeleton, Tabs | 35 sampai 50 | Sheet bawah dan fokus-trap. Radix Dialog di PWA dengan layar kecil |
| U3 | Kerangka web staf (menu samping 240 px), HP guru (bilah bawah), portal, kios; `loading.tsx`, `error.tsx`, `not-found.tsx` per route group | 15 sampai 25 | `(staf)/layout.tsx` memuat `WorkspaceProvider`, `OfflineSync`, service worker. Kerangka baru tidak boleh mematahkan redirect `/masuk` dan 2FA. Menu harus memakai `useCapability` dan peran yang sudah ada di `lib/*-access.ts`, bukan if jenjang |
| U4a | Beranda guru di `/hari-ini` | 4 sampai 6 | Halaman sama dipakai peran lain (`scope=all`) dan memuat prefetch offline. Fungsi "sedang berlangsung" harus memakai jam server |
| U4b | `features/presensi/reducer.ts` + `AttendanceFlow` di `/sesi/[id]` | 8 sampai 12 | **Paling berisiko.** Perilaku sekarang: semua siswa mulai Hadir dan hanya pengecualian dikirim. Kontrak U4b: semua mulai "Belum diisi" dan guru harus menekan "Semua hadir". Itu perubahan perilaku produk dan memengaruhi `presensi.spec.ts`, `presensi-offline.spec.ts`, dan golden e2e. Lihat pertanyaan 5 |
| U5 | Cocokkan antrean offline yang ada dengan kontrak U5 (teks, banner, "Menunggu · n", peringatan keluar akun) | 4 sampai 8 | Hampir semua sudah ada. Risiko: mengganti arsitektur yang sudah lolos e2e. Hanya tambah yang kurang |
| U6a | Papan kedatangan admin | 6 sampai 10 | Aksi Ingatkan tidak punya endpoint |
| U6b | Pola halaman data (header, toolbar, tabel, drawer, dialog) + halaman Siswa | 12 sampai 18 | Tambah dan ubah identitas siswa tidak punya endpoint. Halaman `siswa` 235 baris dengan e2e dan role gate (`lib/student-access.ts`) |
| U6c | Rombel dan Mapel | 10 sampai 16 | Mapel hanya punya GET dan POST. Kenaikan kelas tanpa endpoint. Halaman Mapel baru |
| U6d | Jadwal | 8 sampai 14 | Terbitkan jadwal tidak ada di server. Halaman `jadwal` sudah punya tab, grid, import, kelompok belajar, dan `jadwal.spec.ts` |
| U6e | Guru dan staf | 8 sampai 12 | Hampir seluruh kontrak (status akun, peran per tahun, nonaktifkan, kirim ulang) belum ada |
| U7a | Portal orang tua | 6 sampai 10 | `/portal` memuat PWA, multi-sekolah, picker anak. Jangan mengubah `ChildrenProvider` |
| U7b | Siswa PKL | 4 sampai 6 | Geolokasi dan antrean offline yang ada (Attempt satu kali kirim) |
| U7c | Lapor TPPK | 4 sampai 6 | Route group sendiri tanpa login. Tidak ada isi laporan di URL |
| U7d | Kios pulang | 6 sampai 10 | Kios static export dan IndexedDB v2. Naikkan `APP_VERSION` |
| U8 | Wizard Setup jenjang | 6 sampai 10 | Wizard sudah menyimpan per langkah di server |
| U9a | Aksesibilitas dan bahasa | 15 sampai 30 | Banyak teks tersebar di JSX. Memindahkannya ke `messages/id.ts` menyentuh hampir semua halaman |
| U9b | Visual, performa, CI | 6 sampai 12 | Batas Lighthouse belum ditentukan (daftar konfirmasi prompt) |

## 5. Hal yang tidak cocok antara prompt dan repo (tidak mengubah apa pun, hanya dicatat)

1. **Kewajiban `if (jenjang)`.** Aturan prompt sama dengan aturan 1 di CLAUDE.md. Tidak ada konflik.
2. **Server Component dan Server Action.** Bertentangan dengan pola `api()` klien (lihat bagian 2).
3. **`packages/ui/messages/id.ts`.** Belum ada. Teks halaman sekarang tersebar di JSX dan di `lib/*` (mis. `STATUS_LABELS` di `lib/attendance.ts`). Dibuat di U2.
4. **Fokus.** Papan Sistem-UI menulis "garis stabilo 3 px". Blok CLAUDE.md dan U1 memutuskan cincin hijau papan 2 px dengan jeda kapur 2 px, karena stabilo di atas kapur kontrasnya di bawah 3:1. Diikuti.
5. **Status "Telat" pada papan statis.** Warna kontras tertulis di papan (4,8:1) dan di U1 (`#9A5B00` di atas `#FBEFD9`). Diperiksa otomatis di U1, bukan dipercaya dari papan.
6. **Kode presensi.** Repo memakai `H, S, I, A, T` (`CHOICES` di `sesi/[id]`). Prompt dan papan memakai urutan tetap Hadir, Telat, Izin, Sakit, Alpa. Urutan tampilan berubah, kode ke server tidak.
7. **Prompt U4b hitung ketukan.** 1 + 3 x 2 + 2 = 9 ketukan. Dengan perilaku sekarang (semua mulai Hadir) angkanya 3 x 2 + 1 = 7. Angka akhir diukur di U4b.

## 6. Pertanyaan terbuka

**Terjawab 2026-11-24:** pertanyaan 1 (styling): pindah ke Tailwind v4, tanpa preflight sampai halaman lama dipindah.
Pertanyaan 8 (warna): disetujui, seluruh aplikasi mengikuti `tokens.json`. Animasi untuk sisi admin lewat pustaka (GSAP) juga
diminta; dikerjakan di PR terpisah setelah token, hanya untuk web staf di layar lebar, memuat lazy, dan menghormati
`prefers-reduced-motion` (aturan CLAUDE.md untuk HP guru: tanpa animasi berat). Sisanya masih terbuka.

Pertanyaan ini perlu jawaban pemilik produk sebelum fase yang disebut dimulai. Tidak ada yang menghalangi U1.

**Diputuskan 2026-11-24 oleh Claude** atas arahan pemilik ("untuk keperluan keputusan, jawab dengan perspektif terbaik Anda").
Ini keputusan kerja, bukan persetujuan produk; masing-masing bisa dibalik dengan satu PR kecil sebelum fase terkait selesai.

| # | Keputusan | Alasan |
| --- | --- | --- |
| 2 | Tetap `api()` di klien. Tidak ada Server Component atau Server Action. | Fondasi auth baru tidak ada dan tidak dibutuhkan desain. Pola sekarang sudah lolos e2e. |
| 3 | Papan "Hari ini" admin menjadi bagian atas `/dasbor` (admin, kepsek, wakasek). `/hari-ini` tetap daftar sesi. | Tidak memindahkan rute yang dipakai e2e, prefetch offline, dan peran lain. |
| 4 | `/lapor/lacak` dipertahankan. | Pelapor anonim hanya punya kode; tanpa itu tidak bisa melihat status. U7c melarang daftar laporan, bukan pencarian dengan kode. Tidak ada isi laporan di URL. |
| 5 | Ikuti desain: semua siswa mulai "Belum diisi", tombol "Semua hadir" terlihat, ada Urungkan. Kirim tetap hanya pengecualian. | Aturan tetap CLAUDE.md: tidak ada isian diam-diam. API tidak berubah (yang tidak dikirim tetap hadir); hanya keadaan awal layar dan tombol Kirim (nonaktif dengan alasan selama masih ada "Belum diisi"). `presensi*.spec.ts` dan golden e2e diubah di U4b. |
| 6 | Halaman U6 memakai endpoint yang ada. Fitur tanpa endpoint (tambah dan ubah identitas siswa, rombel baru, kenaikan kelas, arsip mapel, terbitkan jadwal, status akun, Ingatkan) disembunyikan, bukan tombol mati, dan dicatat di PR. | Tidak membuat kontrak API yang belum dirancang. Daftar jadi antrean PR absah-api. |
| 7 | Alasan keluar hanya yang didukung API: "Pindah sekolah" (moved) dan "Keluar" (left). | Enrollment tidak menyimpan alasan; menyimpan teks bebas butuh keputusan privasi dan perubahan skema. |
| 9 | Layar Pulang tetap di halaman kios yang ada. | Kios satu halaman static export dengan IndexedDB v2; menambah rute tidak memberi manfaat. |
| 10 | Tidak diselidiki. | Alur CRUD U6 memakai desain Absah. |
| tombol utama ditekan, tema gelap (3,46:1) | Warna tidak diubah. Tombol tetap memakai `papan` yang digelapkan. Diteruskan ke pemilik desain. | Prompt melarang mengubah warna agar cocok; kontras tombol tetap di atas 3:1 pada keadaan lain. |


1. **Styling (sebelum U1).** Tetap CSS modules dengan token variabel CSS (disarankan, tanpa mengubah 14 berkas CSS dan kios), atau pindah ke Tailwind v4 seperti bawaan prompt? Pindah berarti menulis ulang gaya seluruh aplikasi.
2. **Data (sebelum U4a).** Tetap `api()` di klien (disarankan), atau memperkenalkan Server Component dengan cookie diteruskan ke API? Prompt U4 sampai U8 menyebut "halaman server" dan "Server Action"; di repo ini keduanya perlu fondasi auth baru.
3. **Papan Main (sebelum U6a).** Papan "Hari ini" admin ditaruh di mana: ganti isi `/hari-ini` untuk admin dan kepsek (daftar sesi guru pindah ke `/guru`), atau jadikan halaman tersendiri di `/dasbor`?
4. **Pelacakan laporan TPPK (sebelum U7c).** U7c melarang "daftar atau penelusuran laporan untuk pelapor", sedangkan `/lapor/lacak` dan e2e `tppk.spec.ts` sudah ada. Dipertahankan atau dihapus?
5. **Perilaku "Semua hadir" (sebelum U4b).** Sekarang semua siswa mulai Hadir dan guru menandai pengecualian. Papan dan KONTRAK U4b: semua mulai "Belum diisi", guru menekan "Semua hadir", ada Urungkan. Ini mengubah aturan produk (siswa tanpa isian tidak lagi dianggap hadir). Ikuti desain?
6. **Kontrak API yang belum ada (sebelum U6).** Daftar di bagian 3 (tambah siswa, ubah identitas, tambah rombel, kenaikan kelas, arsip dan atribut mapel, terbitkan jadwal, status akun dan peran per tahun, pengingat). Dikerjakan di absah-api lebih dulu, atau halaman memakai yang ada dan fitur yang belum ada ditunda?
7. **Alasan keluar siswa.** Desain punya Pindah sekolah, Lulus, Mengundurkan diri, Salah input; enrollment hanya `moved` dan `left`. Apakah alasan perlu disimpan?
8. **Warna.** `tokens.json` (papan `#1E5B4B`) mengganti hijau `#0f7a4f` yang dipakai seluruh aplikasi sekarang. Disetujui seluruh aplikasi berubah warna di U1?
9. **Kios.** Prompt menyebut "rute /pulang"; kios adalah satu halaman. Layar Pulang tetap di dalam halaman itu?
10. **Platform go.absensekolah.online.** Belum dipelajari dari dalam (daftar konfirmasi prompt). Alur CRUD U6 berasal dari desain Absah sendiri.

## 7. Catatan U9a (aksesibilitas dan bahasa)

Keputusan kerja (mudah dibalik): U9a tidak memindahkan seluruh teks sekaligus. Pencacahan: sekitar 1000 teks literal di 113 berkas halaman, hampir semuanya
halaman lama yang belum direstyle. Memindahkannya dalam satu PR tidak bisa ditinjau dan berisiko merusak e2e yang mencari teks. Yang dikerjakan:
1. Cacat nyata: `text-h3` (tidak ada di `tokens.css`) dipakai di tiga halaman dan kios; diganti.
2. Penjaga: `packages/ui/src/repo-conventions.test.ts` (token yang tidak ada, daftar halaman yang sudah bersih dari teks di JSX).
3. axe pada halaman nyata: `apps/web/e2e/a11y.spec.ts` (terang, gelap, laptop, HP).
Sisanya mengikuti aturan: halaman lama dipindahkan bersama restyle-nya dan masuk daftar `MOVED`.

## 8. Catatan U9b (visual, performa, CI)

Keputusan kerja (mudah dibalik) untuk batas yang belum ditentukan:
- **Performa**: anggaran ukuran JS pertama-buka per halaman (gzip) dari hasil build, diperiksa di CI. Angka saat ditetapkan: terbesar 310,5 kB, masuk 240 kB, lapor 295 kB; batas 330 / 260 / 310 kB.
- **Lighthouse**: tidak dipasang di CI. Skor kinerjanya bergeser antar-mesin dan memblokir PR tanpa sebab; aksesibilitasnya sudah diuji axe pada halaman nyata (U9a). Bila nanti dipasang: aksesibilitas >= 0,95 dan praktik terbaik >= 0,9 sebagai pemblokir, kinerja hanya peringatan.
- **Regresi visual dengan screenshot**: tidak dipasang (baseline macOS dan Linux CI berbeda). Bukti visual tetap `docs/ui/uNN/` per PR.
- Temuan: dasar bersama sekitar 240 kB gzip (React + Next); halaman aplikasi menambah sekitar 60 kB, sebagian besar zod dari `@absah/contracts` di klien. Memperkecilnya butuh perubahan di absah-api (skema tanpa zod di klien), bukan di sini.


## 9. Fase UA (masuk, akun, gerak)

Sumber: dokumen "Prompt Claude Code: Slicing UI/UX Absah", bagian Fase UA, dan tiga papan baru `Auth-masuk`, `Auth-alur`, `Motion-UI`
(disalin ke `design/boards`; `Auth-alur` dan `Motion-UI` punya acuan PNG). UA1 sampai UA4, satu PR per fase.

Keputusan kerja (mudah dibalik), berlaku untuk seluruh fase:
- **Rute tetap di grup `(akun)`**, bukan `(auth)` seperti usulan prompt: `/masuk`, `/undangan` dan `/keamanan/dua-langkah` sudah dipakai e2e, tautan WhatsApp, dan PWA. Rute baru ditambah di grup yang sama.
- **Angka waktu** (tautan 30 menit, kode 5 menit, kirim ulang 60 detik, sesi diam 30 menit, kunci 10 menit setelah 5 salah, ingat saya 30 hari) ada di satu berkas, `apps/web/lib/auth-config.ts`. Server yang memutuskan; klien hanya menampilkan.
- **Server belum punya** pemulihan kata sandi (tidak ada pengirim email di absah-api; Better Auth menjawab "Reset password isn't enabled"), hitungan sisa percobaan, dan kunci akun dengan jam buka. Halaman ditulis terhadap kontrak Better Auth yang standar dan memetakan jawaban yang ada (401 salah, 429 terlalu banyak dengan `X-Retry-After`). Bagian yang butuh server diberi tanda di PR sebagai catatan backlog absah-api, bukan dibuat-buat di klien.
- **Gerak baru** hanya dari token di `tokens.json` (UA1). Gerak yang tidak punya padanan komponen dicatat di PR, tidak diciptakan.

### UA1
Token gerak masuk ke `tokens.json` (bukan hanya CSS), keyframes dan kelas `motion-*` di `base.css`, lima komponen dan dua hook di `packages/ui/src/components/motion`.
`Button loading` kini tetap berwarna (papan Motion-UI kartu 2: sibuk bukan nonaktif). `Banner` turun 8 px saat muncul. Peta 12 gerak ke komponen: Storybook, Gerak/Komponen.
Kartu tanpa padanan: 6 (syarat menyala, dibuat di UA3), 10 (status berganti), 11 (garis Urungkan menyusut). Kartu 8 (lembar naik) sudah dipenuhi `Sheet`.
