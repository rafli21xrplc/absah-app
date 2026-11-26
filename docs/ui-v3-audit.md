# Audit UI v3 (V0)

Acuan: dokumen "Prompt Claude Code: UI v3 informatif, solid, compact" dan dua tangkapan board di
`design/reference/Hari-ini-v3.png` dan `design/reference/Presensi-v3.png`. Berkas `Hari-ini-v3.dc.html` dan
`Presensi-v3.dc.html` belum ada di repo, jadi tangkapan itu yang dipakai sebagai acuan visual.
Keadaan awal: cabang `ui/pg3-padat` (PR #95).

## Keputusan pemilik produk (2026-11-26)

1. Semua fase V0 sampai V6 dikerjakan, masing-masing satu PR bertumpuk di atas #95.
2. Blok yang datanya belum dikirim API **tidak tampil** di halaman. Komponennya dibuat lengkap dengan story dan
   fixture. Kebutuhan backend ditulis di bagian akhir audit ini dan di PR fase terkait, dengan penanda `TODO(api)`.
   Ini mengikuti aturan U6a di CLAUDE.md: angka dari API apa adanya.
3. Menu samping memakai gaya terang v3: item aktif `papan-soft`, penanda 4 px di tepi kiri, dan `aria-current`.
   Gaya hijau tua CMS1 diganti di V2.

## Token

Nama token mengikuti konvensi repo (`kapur`, `papan`, ...), karena kelas Tailwind dibentuk dari nama token
(`bg-ubin`, `rounded-kartu`, `shadow-kartu`). Peta dari nama di dokumen:

| Dokumen | Repo (kelas) | Catatan |
| --- | --- | --- |
| --warna-latar-app | `latar-app` | baru |
| --warna-kartu | `kapur-raised` | sudah ada, #FFFFFF |
| --warna-ubin | `ubin` | baru |
| --warna-hairline | `hairline` | baru |
| --warna-track | `track` | baru |
| --warna-batas-kontrol | `garis-kuat` | sudah ada, #848C84 |
| --warna-batas-lembut | `batas-lembut` | baru |
| --warna-main | `papan` | sudah ada |
| --warna-main-hover | `papan-deep` | sudah ada, #184A3D |
| --warna-main-deep | `papan-hero` | baru, #143F34 (+ `on-papan-hero`, `papan-hero-muted`) |
| --warna-main-soft | `papan-soft` | sudah ada |
| --warna-stabilo-soft | `stabilo-soft` + `on-stabilo-soft` | baru |
| --warna-teks-muted | `tinta-muted` | sudah ada, #5B6661 |
| --warna-grafik-batang | `grafik-batang` | baru, #5F9F89 (bukan #BFD9CE board, 1,50:1) |
| --warna-grafik-fokus | `papan` | sama nilainya |
| --warna-grafik-target | `grafik-target` | baru |
| pil delta | `delta-baik`, `delta-buruk`, `delta-netral` (+ `-soft`) | baru |
| avatar | `avatar-1..5`, `on-avatar-1..5` | baru, dipilih dari hash ID |
| --radius-kartu / ubin / kontrol | `rounded-kartu` 20, `rounded-ubin` 14, `rounded-kontrol` 12 | baru |
| --bayangan-kartu / hero / aksi | `shadow-kartu`, `shadow-hero`, `shadow-aksi` | baru, bagian `shadow` di tokens.json |
| teks | `text-isi` 14/20, `text-isi-strong`, `text-judul-kartu` 16/24, `text-mini` 12/16, `text-sumbu` 11/14, `text-angka-ubin` 30/34, `text-angka-hero` 40/44 | baru |

Nilai tema gelap untuk token baru disusun sendiri (dokumen hanya memberi tema terang). Semuanya lulus uji kontras di
`tokens.test.ts`, dengan pasangan yang sama seperti tema terang. Aturan "Radius 6, 10, atau 16 saja" di CLAUDE.md
diperbarui di V1: kartu, ubin, dan kontrol v3 memakai 20, 14, dan 12.

## Komponen

| v3 | Keadaan sekarang | Rencana |
| --- | --- | --- |
| Card | `Card`, `.card-surface` (radius 16, garis + bayangan tipis) | V1: radius kartu, `shadow-kartu`, tanpa garis, padding 20 |
| Button | `Button` (primary, secondary, ghost, danger), tinggi 44/52 | V1: varian lunak, outline `batas-lembut`, ukuran 44/40/36, `shadow-aksi` |
| Chip, StatusChip | `StatusPill` (huruf + kata), `Badge`, `StatusChip` portal | V1: `Chip` dan `StatusChip` (titik + label) |
| DeltaPill | tidak ada | V1: baru |
| Avatar | `Avatar` di sidebar-menus, `initials` | V1: ukuran 30/36/38/40, warna dari hash ID |
| ProgressBar, StackBar | `ProgressBar`, `CompositionBar`, `StackedBars` | V1: tinggi 8 px, track, target, `role="img"` |
| AppShell | `AppShell` + `SideNav tone="sidebar"` (hijau tua), grup lipat | V2: sidebar terang 248 px, ikon 72 px di bawah 1280, laci di bawah 1024, lencana hitungan, lompat ke konten |
| PageHeader, DateSwitcher | `DataHeader`, judul halaman bebas, tanpa pengganti tanggal | V2: baru |
| StatGroupCard | `StatCard` (satu angka per kartu) | V3: tiga ubin per kartu |
| HeroRingCard | tidak ada | V3: baru |
| TrendBarChart | tren kecil di dasbor PG2 | V3: SVG sendiri, target, ringkasan teks |
| Histogram | tidak ada | V3: baru (data belum ada) |
| ActivityFeed | tidak ada | V3: baru (data belum ada) |
| ListCard | `CountList`, `TaskRow`, `AlertRow` | V3: kartu daftar dengan hitungan di judul |
| DataTable | `Table` (+ `dense`, `bare`) | V5: kepala lengket, kolom pertama lengket, elipsis + title |
| MasukPulangCell | tidak ada | V5: baru (data belum ada di API per siswa) |
| Toolbar | `DataToolbar`, `SearchBox`, `Select`, `SegmentedControl` | V5: tinggi 44, chip filter aktif yang bisa dihapus |
| Pagination | `Pagination` + `usePaged` | V5: "Menampilkan 1–10 dari n", `aria-current` |

## Data yang tersedia dan yang belum

Tersedia di API:
- `GET /dashboard/principal`: hitungan H/T/I/S/A hari ini, `presentRate`, **tren 14 hari** (`presentRate` per tanggal),
  sesi (total, terisi, terlewat, belum jatuh tempo, `fillRate`), peringatan dini, MBG.
  Delta Hadir terhadap kemarin bisa dibaca dari dua titik tren terakhir.
- `GET /attendance/today?scope=all`: sesi hari ini (untuk "Sesi belum diisi", Presensi kelas).
- `GET /gate/board`: per rombel tepat waktu, telat, belum datang. `GET /gate/today`: daftar telat dengan jam datang.
- `GET /reports/attendance/classes`: kehadiran per rombel (dasar "rombel terendah").
- `GET /leave-requests?status=pending`: izin menunggu.

Belum ada di API: `TODO(api)`, blok disembunyikan di halaman.
1. Delta terhadap kemarin untuk Telat, Izin, Sakit, Alpa (tren hanya membawa `presentRate`).
2. Histogram jam datang per 15 menit (`/gate/today` hanya memuat siswa telat).
3. Hitungan pulang awal.
4. Kehadiran per tingkat (bisa dijumlahkan di API dari per rombel; klien tidak menghitung rekap).
5. Aktivitas terbaru (pengingat terkirim, sesi terisi, kios sinkron, porsi MBG, izin diajukan).
6. Rata-rata menit telat.
7. Presensi harian **per siswa** dengan jam masuk/pulang dan sumber (gerbang, guru, WhatsApp ortu, portal) untuk
   tabel Presensi kelas v3. Yang ada hanya per sesi.
8. Paginasi dari server untuk daftar di atas (900 siswa).
9. Pengingat ke guru ("Ingatkan", "Ingatkan semua").
10. Target kehadiran (95%) dan jam bel masuk sebagai pengaturan sekolah. Sampai ada, target tidak digambar.

## Selisih dari board

- Kolom isian memakai `garis-kuat` (#848C84, 3,46:1), bukan batas pucat board.
- Batang grafik non-aktif memakai `grafik-batang` (#5F9F89), bukan #BFD9CE.
- Blok tanpa data (daftar di atas) tidak tampil.
- Tabel Presensi kelas memakai satu baris per sesi, bukan per siswa, sampai butir 7 tersedia.
