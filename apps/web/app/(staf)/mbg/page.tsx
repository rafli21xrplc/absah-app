'use client';

import { MbgDaily, MbgSettings } from '@absah/contracts';
import { Button, DateInput, Input, LoadingState } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { normalizePhone } from '@/lib/auth';
import { clock, MBG_MANAGERS, mbgStatusLine } from '@/lib/mbg';
import { useWorkspace } from '@/lib/workspace';
import { MbgForecastSection } from './forecast';
import forms from '../../forms.module.css';
import styles from '../data.module.css';

/**
 * Jumlah hadir MBG (RKP-08): today's present students per rombel, sent to the PIC at the cutoff.
 * Admins set the cutoff and PIC, and can send a correction when attendance changed afterwards.
 */
export default function MbgPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const manager = hasRole(...MBG_MANAGERS);
  const [daily, setDaily] = useState<MbgDaily | null>(null);
  const [settings, setSettings] = useState<MbgSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!schoolId) return;
    Promise.all([api('/mbg/daily', MbgDaily, { schoolId }), api('/mbg/settings', MbgSettings, { schoolId })])
      .then(([d, s]) => {
        setDaily(d);
        setSettings(s);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat data MBG.'));
  }, [schoolId]);
  useEffect(load, [load]);

  async function recount() {
    if (!schoolId || !daily) return;
    setBusy(true);
    setNotice(null);
    try {
      const next = await api('/mbg/daily/recount', MbgDaily, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey() });
      const changed = JSON.stringify(next.classes) !== JSON.stringify(daily.classes);
      setDaily(next);
      setNotice(changed ? 'Koreksi tersimpan dan dikirim ke PIC.' : 'Angka tidak berubah. Tidak ada koreksi yang dikirim.');
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Koreksi gagal. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId || !settings) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const typed = normalizePhone(String(data.get('picPhone') ?? ''));
    const picName = String(data.get('picName') ?? '').trim();
    const body = {
      cutoffTime: String(data.get('cutoffTime') ?? settings.cutoffTime).slice(0, 5),
      picName: picName || null,
      // Left out keeps the stored number; "hapus" removes it; a typed number replaces it.
      ...(data.get('clearPhone') === 'on' ? { picPhone: null } : typed ? { picPhone: typed } : {}),
    };
    setBusy(true);
    setNotice(null);
    try {
      setSettings(await api('/mbg/settings', MbgSettings, { method: 'PUT', schoolId, idempotencyKey: newIdempotencyKey(), body }));
      setNotice('Pengaturan MBG tersimpan.');
      form.reset();
      load();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') setNotice('Periksa jam (HH.MM) dan nomor WhatsApp (diawali 08 atau +628).');
      else setNotice(err instanceof ApiError ? err.message : 'Tidak tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Jumlah hadir MBG</h1>
      {error && <p role="alert">{error}</p>}
      {!daily && !error && <LoadingState variant="cards" />}
      {notice && <p role="status">{notice}</p>}
      {daily && (
        <>
          <div className={styles.counts} aria-label="Hari ini">
            <p className={styles.count}>
              <strong>{daily.total.present}</strong> siswa hadir
            </p>
            <p className={styles.count}>
              <strong>{daily.total.enrolled}</strong> siswa aktif
            </p>
            {daily.total.unrecorded > 0 && (
              <p className={styles.count}>
                <strong>{daily.total.unrecorded}</strong> belum diisi
              </p>
            )}
          </div>
          <p className={styles.muted}>{mbgStatusLine(daily, timezone)}</p>
          {daily.classes.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Rombel</th>
                    <th className={styles.num}>Hadir</th>
                    <th className={styles.num}>Siswa</th>
                    <th className={styles.num}>Belum diisi</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.classes.map((c) => (
                    <tr key={c.classId}>
                      <td>
                        {c.name} {c.corrected && <span className={styles.badgeWarn}>dikoreksi</span>}
                      </td>
                      <td className={styles.num}>{c.present}</td>
                      <td className={styles.num}>{c.enrolled}</td>
                      <td className={styles.num}>{c.unrecorded || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {manager && daily.status === 'counted' && (
            <section className={styles.section} aria-labelledby="koreksi">
              <h2 id="koreksi">Koreksi</h2>
              <p className={styles.muted}>Bila presensi berubah setelah jam batas, kirim angka terbaru ke PIC. Angka yang sudah terkirim tetap tercatat.</p>
              <Button variant="secondary" disabled={busy} onClick={() => void recount()}>
                Hitung ulang dan kirim koreksi
              </Button>
            </section>
          )}
        </>
      )}
      {schoolId && <MbgForecastSection schoolId={schoolId} timezone={timezone} />}
      {settings && (
        <section className={styles.section} aria-labelledby="pengaturan">
          <h2 id="pengaturan">Pengaturan</h2>
          {manager ? (
            <form className={forms.form} onSubmit={(e) => void saveSettings(e)}>
              <label className={forms.field}>
                <span className={forms.label}>Jam batas</span>
                <DateInput name="cutoffTime" type="time" required defaultValue={settings.cutoffTime} />
              </label>
              <label className={forms.field}>
                <span className={forms.label}>Nama PIC MBG</span>
                <Input name="picName" defaultValue={settings.picName ?? ''} maxLength={100} autoComplete="off" />
              </label>
              <label className={forms.field}>
                <span className={forms.label}>WhatsApp PIC {settings.picPhone ? `(sekarang ${settings.picPhone})` : '(belum ada)'}</span>
                <Input name="picPhone" type="tel" inputMode="tel" placeholder="0812 3456 7890" autoComplete="off" />
              </label>
              {settings.picPhone && (
                <label>
                  <input type="checkbox" name="clearPhone" /> Hapus nomor PIC (angka tetap dihitung, tidak dikirim)
                </label>
              )}
              <Button type="submit" disabled={busy}>
                Simpan pengaturan
              </Button>
            </form>
          ) : (
            <p>
              Jam batas {clock(settings.cutoffTime)} · PIC {settings.picName ?? 'belum diisi'}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
