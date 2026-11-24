# Bahan desain Absah

Salinan papan dari kanvas "Absah — Desain UI". Desain menang atas prompt, kecuali yang tertulis di desain melanggar
aksesibilitas atau capability. Dalam kasus itu berhenti dan tulis pertanyaan di PR.

```
design/
  boards/*.dc.html     18 papan
  boards/canvas.json   letak, ukuran, dan judul papan
  ds/absah/tokens.json token warna, huruf, jarak, sudut (sumber U1)
  reference/*.png      tangkapan layar papan statis (hasil render.mjs)
  render.mjs           membuat reference/*.png
```

## Membuat tangkapan layar acuan

```
pnpm install
pnpm exec playwright install chromium   # sekali saja
node design/render.mjs                  # sembilan papan statis
node design/render.mjs Sistem-UI        # satu papan
```

Skrip membuang pembungkus `<x-dc>`, `<helmet>`, dan semua `<script>`, lalu memotret halaman pada lebar dan tinggi
papan dari `canvas.json`. Huruf Plus Jakarta Sans diambil dari Google Fonts; tanpa internet, halaman memakai font
sistem dan tangkapan layar akan sedikit berbeda. Hasil render dibuat ulang bila papan berubah.

## Dua jenis papan

**Papan statis** adalah HTML dengan gaya inline. Ukuran, warna, jarak, dan teks tertulis di dalamnya, jadi bisa dibaca
sebagai spesifikasi dan dirender biasa. Ada sembilan:

| Papan | Ukuran | Fase |
| --- | --- | --- |
| Sistem-UI | 1520 x 2960 | U1, U2 |
| Alur-presensi | 3090 x 1170 | U4, U5 |
| Riset-UI | 1520 x 2260 | hanya dibaca |
| Ortu-portal-sd | 390 x 844 | U7a |
| Siswa-pkl | 390 x 844 | U7b |
| Lapor-tppk | 390 x 844 | U7c |
| Kios-pulang | 1180 x 820 | U7d |
| Auth-alur | 2230 x 2332 | UA3, UA4 |
| Motion-UI | 1520 x 2620 | UA1 |

**Papan bertemplat** memuat kelas `Component` di dalam `<script type="text/x-dc">`, lubang berkurung ganda, serta tag
`sc-if` dan `sc-for`. Itu hanya bisa dirender di dalam kanvas, jadi **tidak dirender di sini dan tidak dijalankan**.
Bacalah kelas `Component` sebagai pseudo-kode perilaku (state, aturan, teks) dan baca markup di bawahnya untuk tata
letak. Ada sembilan: Main, Guru-isi-sesi, Setup-jenjang, Auth-masuk, Data-siswa, Data-rombel, Data-mapel, Data-jadwal, Data-guru.
Untuk papan ini tidak ada PNG acuan; perbandingan visual dilakukan di Storybook dan di halaman hasil, dengan papan
dibuka di kanvas oleh manusia.

## Aturan membaca

- **Teks diambil dari berkas**, bukan ditebak dari gambar. Teks papan adalah kontrak.
- **Tabel** di papan dibuat dari `div role="grid"`. Di kode pakai `<table>` semantik, tampilan sama.
- **Fokus.** Papan Sistem-UI menulis "garis stabilo 3 px" untuk fokus. Abaikan: pakai cincin hijau papan 2 px dengan jeda
  kapur 2 px (token `focus`), karena kontras stabilo terhadap kapur di bawah 3 : 1.
- **Tokens.** Bila angka di papan berbeda dari `ds/absah/tokens.json`, `tokens.json` menang dan selisihnya dicatat di PR.
- **Tahun ajaran** ada di menu tetapi belum didesain. Jangan dibangun sebelum papannya ada.
- Ukuran tangkapan layar: 390 x 844 (HP guru), 1440 x 900 (web staf), 1180 x 820 (kios).
