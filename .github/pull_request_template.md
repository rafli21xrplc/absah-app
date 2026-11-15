## Ringkasan

<!-- Kode fitur (mis. PRS-03) dan bagian docs/architecture.md yang relevan. -->

## Cara menguji

<!-- Perintah atau langkah manual. -->

## Checklist per PR

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
