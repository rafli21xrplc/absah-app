'use client';

import { WorkspaceExport, WorkspaceExportDownload, WorkspaceExportList, WORKSPACE_EXPORT_RETENTION_DAYS } from '@absah/contracts';
import { Button, LoadingState } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { availableUntil, EXPORT_POLL_MS, EXPORT_STATUS_LABELS, exportSummary, hasQueued } from '@/lib/workspace-export';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';

const dateTime = (timezone: string, iso: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** Ekspor data sekolah (PLT-11): the admin takes the school's data along as a ZIP of CSV files and uploaded files. */
export default function EksporDataPage() {
  const { schoolId, me, isAdmin } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [items, setItems] = useState<WorkspaceExport[] | null>(null);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const requestKey = useRef<string | null>(null);

  const load = useCallback(() => api('/workspace/exports', WorkspaceExportList, { schoolId }).then((r) => r.items), [schoolId]);

  useEffect(() => {
    if (!schoolId || !isAdmin) return;
    let timer: number | undefined;
    let stopped = false;
    const tick = () =>
      load()
        .then((list) => {
          if (stopped) return;
          setItems(list);
          if (hasQueued(list)) timer = window.setTimeout(tick, EXPORT_POLL_MS);
        })
        .catch((err: unknown) => {
          if (!stopped) setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Tidak bisa memuat daftar ekspor.' });
        });
    void tick();
    // After a request the page restarts the poll through this event instead of reaching into the effect.
    window.addEventListener('absah:export-requested', tick);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener('absah:export-requested', tick);
    };
  }, [schoolId, isAdmin, load]);

  async function request() {
    requestKey.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    try {
      await api('/workspace/exports', WorkspaceExport, { method: 'POST', body: { includeFiles }, schoolId, idempotencyKey: requestKey.current });
      requestKey.current = null;
      setMessage({ ok: true, text: 'Ekspor diminta. Berkas disiapkan di latar belakang; halaman ini diperbarui sendiri.' });
      window.dispatchEvent(new Event('absah:export-requested'));
    } catch (err) {
      if (err instanceof ApiError) requestKey.current = null; // an answer ends the action; a lost reply keeps the key
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Tidak terkirim. Periksa sinyal, lalu coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  async function download(id: string) {
    // The tab is opened inside the click so a popup blocker lets it through; the link is only known after the call.
    const tab = window.open('', '_blank');
    try {
      const link = await api(`/workspace/exports/${id}/download`, WorkspaceExportDownload, { schoolId });
      if (tab) tab.location.href = link.url;
      else window.location.assign(link.url);
    } catch (err) {
      tab?.close();
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Tidak bisa membuka berkas.' });
      void load().then(setItems);
    }
  }

  if (!isAdmin) {
    return (
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <p role="alert">Ekspor data sekolah hanya untuk admin sekolah.</p>
      </main>
    );
  }

  const queued = items ? hasQueued(items) : false;
  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Ekspor data sekolah</h1>
      <p className={styles.muted}>
        Satu berkas ZIP berisi satu file CSV per tabel (siswa, rombel, presensi, dan seterusnya) dan berkas unggahan sekolah. Isinya data semua siswa: simpan di tempat
        aman. Berkas dihapus otomatis {WORKSPACE_EXPORT_RETENTION_DAYS} hari setelah dibuat, setiap unduhan tercatat, dan data TPPK hanya ikut bila Anda anggota tim TPPK.
      </p>
      <label className={forms.field}>
        <span>
          <input
            type="checkbox"
            checked={includeFiles}
            disabled={busy || queued}
            onChange={(e) => {
              requestKey.current = null; // a different answer is a new action
              setIncludeFiles(e.target.checked);
            }}
          />{' '}
          Sertakan berkas unggahan (foto, surat izin, lampiran)
        </span>
      </label>
      <Button disabled={busy || queued} onClick={() => void request()}>
        {busy ? 'Meminta…' : queued ? 'Sedang dibuat…' : 'Minta ekspor'}
      </Button>
      {message && (
        <p className={message.ok ? undefined : forms.error} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      <section className={styles.section} aria-labelledby="riwayat">
        <h2 id="riwayat">Riwayat ekspor</h2>
        {!items && !message && <LoadingState />}
        {items?.length === 0 && <p className={styles.muted}>Belum ada ekspor.</p>}
        <ul>
          {items?.map((e) => (
            <li key={e.id} className={styles.notice}>
              <p>
                <strong>{EXPORT_STATUS_LABELS[e.status]}</strong> · diminta {dateTime(timezone, e.createdAt)}
              </p>
              <p className={styles.muted}>{exportSummary(e)}</p>
              {e.status === 'done' && e.finishedAt && (
                <>
                  <p className={styles.muted}>Tersedia sampai {dateTime(timezone, availableUntil(e.finishedAt))}.</p>
                  <Button variant="secondary" onClick={() => void download(e.id)}>
                    Unduh {e.fileName ?? 'berkas'}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
