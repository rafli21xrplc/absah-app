'use client';

import { TracerFormContext } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError } from '@/lib/api';
import { answerRequest, ORGANIZATION_LABELS, POSITION_LABELS, TRACER_STATUS_LABELS, TRACER_STATUSES, tokenFromHash } from '@/lib/tracer';
import forms from '../../forms.module.css';
import styles from './alumni.module.css';

const TOKEN_KEY = 'absah.tracerLink';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; token: string; ctx: TracerFormContext };

/** Why a link does not open, in words an alumnus understands. */
function linkError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'LINK_EXPIRED') return 'Tautan ini sudah tidak berlaku. Hubungi sekolah untuk meminta tautan baru.';
  if (err instanceof ApiError && err.status === 401) return 'Tautan tidak dikenal. Buka tautan langsung dari pesan WhatsApp sekolah.';
  if (err instanceof ApiError && err.status === 404) return 'Pengisian kabar alumni sedang tidak dibuka sekolah.';
  return 'Tidak bisa terhubung. Periksa internet lalu coba lagi.';
}

/**
 * Tracer study (PKL-05) for an alumnus, opened from a WhatsApp message. The token comes from the URL fragment, is kept for
 * reloads in this tab only and removed from the address bar; calls send it as `Authorization: Tracer <token>`, cookies omitted.
 */
export default function AlumniPage() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    // Runs after mount only: the fragment and sessionStorage exist in the browser alone.
    void Promise.resolve().then(async () => {
      let token = tokenFromHash(window.location.hash);
      try {
        if (token) sessionStorage.setItem(TOKEN_KEY, token);
        else token = tokenFromHash(sessionStorage.getItem(TOKEN_KEY) ?? '');
      } catch {
        // private mode: the fragment stays the only copy
      }
      if (token && window.location.hash) window.history.replaceState(null, '', window.location.pathname);
      if (!token) {
        setLoad({ state: 'error', message: 'Tautan tidak lengkap. Buka tautan langsung dari pesan WhatsApp sekolah.' });
        return;
      }
      try {
        setLoad({ state: 'ready', token, ctx: await api('/tracer/form', TracerFormContext, { tracerToken: token }) });
      } catch (err) {
        setLoad({ state: 'error', message: linkError(err) });
      }
    });
  }, []);

  if (load.state === 'loading') return <main className={styles.page}><p role="status">Memuat…</p></main>;
  if (load.state === 'error') {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Kabar alumni</h1>
        <p role="alert">{load.message}</p>
      </main>
    );
  }
  return <AlumniForm token={load.token} initial={load.ctx} />;
}

function AlumniForm({ token, initial }: { token: string; initial: TracerFormContext }) {
  const [ctx, setCtx] = useState(initial);
  const [status, setStatus] = useState<string>(initial.response?.status ?? '');
  const [organization, setOrganization] = useState(initial.response?.organization ?? '');
  const [position, setPosition] = useState(initial.response?.position ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = answerRequest(status, organization, position);
    if ('error' in request) {
      setError(request.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setCtx(await api('/tracer/form', TracerFormContext, { method: 'PUT', tracerToken: token, body: request.body }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? (fieldError(err, 'organization') ?? linkError(err)) : linkError(err));
    } finally {
      setBusy(false);
    }
  }

  const named = status === 'bekerja' || status === 'melanjutkan' || status === 'wirausaha' ? status : null;
  const until = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(ctx.expiresAt));
  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>{ctx.schoolName} · angkatan {ctx.graduationYear}</p>
      <h1 className={styles.title}>Halo {ctx.firstName}, apa kabar?</h1>
      <p className={styles.lead}>Sekolah ingin tahu kegiatan Anda sekarang. Isiannya singkat dan dipakai untuk memperbaiki pembelajaran dan membantu adik kelas.</p>

      {saved && (
        <p className={styles.done} role="status">
          Terima kasih, jawaban Anda sudah tersimpan. Anda masih bisa mengubahnya lewat tautan ini sampai {until}.
        </p>
      )}

      <form className={forms.form} onSubmit={(e) => void submit(e)}>
        <fieldset className={styles.choices}>
          <legend className={forms.label}>Sekarang Anda…</legend>
          {TRACER_STATUSES.map((s) => (
            <label key={s} className={styles.choice}>
              <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
              {TRACER_STATUS_LABELS[s]}
            </label>
          ))}
        </fieldset>
        {named && (
          <>
            <label className={forms.field}>
              <span className={forms.label}>{ORGANIZATION_LABELS[named]}</span>
              <input className={forms.input} value={organization} maxLength={120} onChange={(e) => setOrganization(e.target.value)} />
            </label>
            <label className={forms.field}>
              <span className={forms.label}>{POSITION_LABELS[named]}</span>
              <input className={forms.input} value={position} maxLength={120} onChange={(e) => setPosition(e.target.value)} />
            </label>
          </>
        )}
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Menyimpan…' : ctx.response ? 'Simpan perubahan' : 'Kirim'}
        </Button>
      </form>
      <p className={styles.eyebrow}>Tautan ini berlaku sampai {until}. Jangan teruskan ke orang lain.</p>
    </main>
  );
}
