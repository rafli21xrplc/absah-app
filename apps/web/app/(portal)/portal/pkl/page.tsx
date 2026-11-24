'use client';

import { CreatePklAttachmentResponse, PklCheckin, PklJournal, PklToday, type PklCheckinBody } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { putPhoto, toJpeg } from '@/lib/pickup';
import { clockIn, CONFIRM_LABELS, readPosition, REASON_LABELS, STATUS_WORDS } from '@/lib/pkl';
import { useWorkspace } from '@/lib/workspace';
import { PklJournals } from '../../../_pkl/journals';
import styles from '../../portal.module.css';

/** One press of Check-in/Check-out: the same key and body are resent until the server answered. */
interface Attempt {
  key: string;
  body: PklCheckinBody;
}

function checkinText(c: PklCheckin, timezone: string): string {
  const what = c.kind === 'in' ? 'Datang' : 'Pulang';
  const state = c.status ? STATUS_WORDS[c.status] : c.confirmStatus ? CONFIRM_LABELS[c.confirmStatus] : 'tercatat';
  const reasons = c.reviewReasons.length > 0 && !c.status ? ` (${c.reviewReasons.map((r) => REASON_LABELS[r]).join(', ')}; guru pembimbing akan meninjau)` : '';
  return `${what} ${clockIn(c.recordedAt, timezone)} · ${c.distanceM} m dari DUDI · ${state}${reasons}`;
}

/** PKL for the student (PKL-02/03): check in and out at the DUDI, and write today's journal. */
export default function PortalPklPage() {
  const { me, schoolId, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [today, setToday] = useState<PklToday | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const attempt = useRef<Attempt | null>(null);
  const journalKey = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/pkl/me', PklToday, { schoolId })
      .then(setToday)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat PKL. Periksa internet.'));
  }, [schoolId]);
  useEffect(load, [load]);

  async function check(kind: 'in' | 'out') {
    setBusy(true);
    setError(null);
    try {
      if (attempt.current?.body.kind !== kind) {
        const p = await readPosition();
        attempt.current = { key: newIdempotencyKey(), body: { kind, ...p, deviceTime: new Date().toISOString() } };
      }
      await api('/pkl/checkins', PklCheckin, { method: 'POST', schoolId, idempotencyKey: attempt.current.key, body: attempt.current.body });
      attempt.current = null;
      load();
    } catch (err) {
      // The server answered: this press is over (409 already_recorded, no_placement, ...).
      if (err instanceof ApiError) attempt.current = null;
      setError(err instanceof Error ? err.message : 'Belum terkirim.');
      if (err instanceof ApiError && err.status === 409) load();
    } finally {
      setBusy(false);
    }
  }

  async function writeJournal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const d = new FormData(formEl);
    const file = d.get('file');
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      let attachment: { id: string; contentType: 'image/jpeg' | 'application/pdf' } | undefined;
      if (file instanceof File && file.size > 0) {
        const pdf = file.type === 'application/pdf';
        const blob = pdf ? file : await toJpeg(file);
        const contentType = pdf ? 'application/pdf' : 'image/jpeg';
        const up = await api('/pkl/journals/attachments', CreatePklAttachmentResponse, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { fileSize: blob.size, contentType } });
        await putPhoto(up.upload, blob);
        attachment = { id: up.attachmentId, contentType };
      }
      journalKey.current ??= newIdempotencyKey();
      const body = { activity: String(d.get('activity') ?? '').trim(), competency: String(d.get('competency') ?? '').trim() || null, ...(attachment ? { attachment } : {}) };
      await api('/pkl/journals', PklJournal, { method: 'POST', schoolId, idempotencyKey: journalKey.current, body });
      journalKey.current = null;
      formEl.reset();
      setSaved('Jurnal hari ini tersimpan.');
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Jurnal belum terkirim. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  const p = today?.placement;
  return (
    <IfCap name="pkl.enabled" fallback={<main className={styles.main}>PKL belum diaktifkan.</main>}>
      <main className={styles.main}>
        <Link href="/portal">← Portal</Link>
        <h1 className={styles.title}>PKL</h1>
        {!hasRole('siswa') && <p>Halaman ini untuk siswa PKL.</p>}
        {error && <p role="alert">{error}</p>}
        {today && !p && <p>Tidak ada PKL yang berjalan hari ini.</p>}
        {p && schoolId && (
          <>
            <section className={styles.card} aria-label="Tempat PKL">
              <strong>{p.partner.name}</strong>
              <br />
              {p.partner.address}
              <br />
              {p.hours ? `Jam kerja hari ini ${p.hours.startsAt.replace(':', '.')}–${p.hours.endsAt.replace(':', '.')}` : 'Hari ini DUDI libur.'}
              <br />
              Pembimbing: {p.schoolMentor ?? '–'} (sekolah), {p.industryMentor ?? 'belum ada'} (industri)
            </section>
            <section aria-label="Kehadiran hari ini">
              {today.checkIn && <p role="status">{checkinText(today.checkIn, timezone)}</p>}
              {today.checkOut && <p role="status">{checkinText(today.checkOut, timezone)}</p>}
              {!today.checkIn && (
                <Button disabled={busy} onClick={() => void check('in')}>
                  {busy ? 'Membaca lokasi…' : 'Check-in sekarang'}
                </Button>
              )}
              {today.checkIn && !today.checkOut && (
                <Button variant="secondary" disabled={busy} onClick={() => void check('out')}>
                  {busy ? 'Membaca lokasi…' : 'Check-out pulang'}
                </Button>
              )}
              <p className={styles.muted}>Lokasi hanya dibaca saat tombol ditekan, dalam radius {p.partner.radiusM} m dari DUDI.</p>
            </section>
            <form onSubmit={(e) => void writeJournal(e)} onChange={() => (journalKey.current = null)} aria-labelledby="jurnal-baru">
              <h2 id="jurnal-baru">Jurnal hari ini</h2>
              <label>
                Kegiatan
                <textarea name="activity" required minLength={5} maxLength={2000} rows={4} />
              </label>
              <label>
                Kompetensi yang dilatih (boleh kosong)
                <input name="competency" maxLength={300} />
              </label>
              <label>
                Foto atau PDF (boleh kosong)
                <input name="file" type="file" accept="image/*,application/pdf" />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? 'Mengirim…' : 'Kirim jurnal'}
              </Button>
              {saved && <p role="status">{saved}</p>}
            </form>
            <h2>Jurnal saya</h2>
            <PklJournals schoolId={schoolId} reload={reload} showStudent={false} />
          </>
        )}
      </main>
    </IfCap>
  );
}
