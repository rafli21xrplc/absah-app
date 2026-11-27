'use client';

import { LiaisonSettings, LiaisonStudentList } from '@absah/contracts';
import { Button, DateInput } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { LiaisonThreads } from '../../_liaison/thread-list';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

/** Buku penghubung for the wali kelas and guru mapel (write) and the admin (read, service hours). */
export default function PenghubungPage() {
  const { schoolId, me, isAdmin } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  return (
    <IfCap name="portal.liaison" fallback={<p className={styles.main}>Buku penghubung belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Buku penghubung</h1>
        {schoolId && <StartThread schoolId={schoolId} />}
        <section className={styles.section} aria-labelledby="percakapan">
          <h2 id="percakapan">Percakapan</h2>
          {schoolId && <LiaisonThreads schoolId={schoolId} timezone={timezone} base="/penghubung" empty="Belum ada percakapan." />}
        </section>
        {schoolId && isAdmin && <ServiceHours schoolId={schoolId} />}
      </main>
    </IfCap>
  );
}

/** Find a student the user teaches to write to the parents. */
function StartThread({ schoolId }: { schoolId: string }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<LiaisonStudentList['items']>([]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(`/liaison/students?q=${encodeURIComponent(query.trim())}`, LiaisonStudentList, { schoolId, signal: controller.signal })
        .then((r) => setFound(r.items))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [schoolId, query]);

  return (
    <section className={styles.section} aria-labelledby="tulis">
      <h2 id="tulis">Tulis ke orang tua</h2>
      <label className={forms.field}>
        Cari siswa yang Anda ajar
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ketik minimal 2 huruf nama" autoComplete="off" />
      </label>
      {query.trim().length >= 2 && (
        <ul className={ui.sessions} aria-label="Hasil pencarian">
          {found.map((s) => (
            <li key={s.id}>
              <Link className={ui.sessionCard} href={`/penghubung/${s.id}`}>
                {s.name}
                {s.className && ` · ${s.className}`}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Admin: WhatsApp notices outside these hours wait for the next start; messages are never held. */
function ServiceHours({ schoolId }: { schoolId: string }) {
  const [startsAt, setStartsAt] = useState('06:00');
  const [endsAt, setEndsAt] = useState('18:00');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/liaison/settings', LiaisonSettings, { schoolId })
      .then((s) => {
        setStartsAt(s.startsAt);
        setEndsAt(s.endsAt);
      })
      .catch(() => undefined);
  }, [schoolId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/liaison/settings', LiaisonSettings, { method: 'PUT', schoolId, idempotencyKey: newIdempotencyKey(), body: { startsAt, endsAt } });
      setMessage('Jam layanan tersimpan.');
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Belum tersimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.section} onSubmit={(e) => void save(e)} aria-labelledby="jam">
      <h2 id="jam">Jam layanan</h2>
      <p>Pemberitahuan WhatsApp di luar jam ini dikirim saat jam layanan dimulai. Pesannya sendiri tetap masuk.</p>
      <label className={forms.field}>
        Mulai
        <DateInput type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      </label>
      <label className={forms.field}>
        Selesai
        <DateInput type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </label>
      {message && <p role="status">{message}</p>}
      <Button type="submit" disabled={busy}>
        Simpan jam layanan
      </Button>
    </form>
  );
}
