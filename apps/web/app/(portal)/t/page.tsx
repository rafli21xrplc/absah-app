'use client';

import { ActionLinkContext, ActionLinkLeave, CardDeviceKeys, LinkHeldPickups, PickupPhotoLink, type LeaveKind, type LinkHeldPickup } from '@absah/contracts';
import { Button, DateInput, Textarea } from '@absah/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/attendance';
import { timeIn } from '@/lib/gate';
import { dateRangeLabel, LEAVE_KIND_LABELS, LEAVE_STATUS_LABELS } from '@/lib/leave';
import { EVENT_STATUS_LABELS } from '@/lib/pickup';
import forms from '../../forms.module.css';
import { CardQr } from '../card-qr';
import { StatusBadge } from '../status-badge';
import styles from '../portal.module.css';

const TOKEN_KEY = 'absah.actionLink';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; ctx: ActionLinkContext };

const dateLabel = (date: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T00:00:00Z`));

/** Why a link does not open, in words a parent understands. */
function linkError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'LINK_EXPIRED') return err.message;
  if (err instanceof ApiError && err.status === 401) return 'Tautan tidak dikenal. Buka tautan langsung dari pesan WhatsApp sekolah.';
  return 'Tidak bisa terhubung. Periksa internet lalu coba lagi.';
}

/**
 * Tautan aksi (ORT-01): opened from a WhatsApp message without logging in. The token sits in the URL
 * fragment, so it never reaches a server log; the API gets it in the Authorization header.
 */
export default function ActionLinkPage() {
  const [token, setToken] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const refresh = useCallback(async (tk: string) => {
    try {
      setLoad({ state: 'ready', ctx: await api('/links/context', ActionLinkContext, { linkToken: tk }) });
    } catch (err) {
      setLoad({ state: 'error', message: linkError(err) });
    }
  }, []);

  useEffect(() => {
    // Runs after mount only: the fragment and sessionStorage exist in the browser alone.
    void Promise.resolve().then(() => {
      // Like invitations: take the token from the fragment, keep it for reloads in this tab only,
      // and clear it from the address bar so it is not shared by a screenshot or a copied URL.
      let tk = window.location.hash.slice(1);
      let kept = false;
      try {
        if (tk) sessionStorage.setItem(TOKEN_KEY, tk);
        else tk = sessionStorage.getItem(TOKEN_KEY) ?? '';
        kept = true;
      } catch {
        // private mode: the fragment stays the only copy
      }
      if (tk && kept && window.location.hash) window.history.replaceState(null, '', window.location.pathname);
      if (!tk) {
        setLoad({ state: 'error', message: 'Tautan tidak lengkap. Buka tautan langsung dari pesan WhatsApp sekolah.' });
        return;
      }
      setToken(tk);
      void refresh(tk);
    });
  }, [refresh]);

  if (load.state === 'loading') return <main className={styles.main}><p role="status">Memuat…</p></main>;
  if (load.state === 'error' || !token) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Tautan sekolah</h1>
        <p role="alert">{load.state === 'error' ? load.message : ''}</p>
      </main>
    );
  }
  const { ctx } = load;
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>{ctx.school.name}</p>
      <h1 className={styles.title}>
        {ctx.student.firstName} · {ctx.student.className}
      </h1>

      {ctx.pickups.length > 0 && <LinkPickups token={token} timezone={ctx.school.timezone} firstName={ctx.student.firstName} initial={ctx.pickups} />}

      <section className={styles.card} aria-labelledby="hari-ini">
        <h2 id="hari-ini">Hari ini, {dateLabel(ctx.today.date)}</h2>
        <p>
          <StatusBadge status={ctx.today.status ?? ctx.today.sessions.find((s) => s.status)?.status ?? null} />
          {ctx.today.arrivedAt && <span className={styles.muted}> · tiba di sekolah {timeIn(ctx.school.timezone, ctx.today.arrivedAt)}</span>}
        </p>
        {ctx.today.sessions.length > 1 && (
          <ul className={styles.list} aria-label="Sesi hari ini">
            {ctx.today.sessions.map((s, i) => (
              <li key={i}>
                <span>Sesi {i + 1}</span>
                <span>{s.status ? STATUS_LABELS[s.status] : 'belum diisi'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="izin">
        <h2 id="izin">Izin</h2>
        {ctx.leaves.length > 0 && (
          <ul className={styles.list} aria-label="Izin terakhir">
            {ctx.leaves.map((l) => (
              <li key={l.id}>
                <span>
                  {LEAVE_KIND_LABELS[l.kind]} · {dateRangeLabel(l.startsOn, l.endsOn)}
                </span>
                <strong>{LEAVE_STATUS_LABELS[l.status]}</strong>
              </li>
            ))}
          </ul>
        )}
        {ctx.canRequestLeave ? (
          <LeaveForm token={token} today={ctx.today.date} onDone={() => void refresh(token)} />
        ) : (
          <p className={styles.muted}>Tautan ini sudah dipakai untuk mengajukan izin. Untuk izin lain, hubungi wali kelas atau tunggu pesan berikutnya.</p>
        )}
      </section>

      {ctx.cardAvailable && <LinkCard token={token} name={ctx.student.firstName} />}

      <p className={styles.muted}>Tautan ini berlaku sampai {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: ctx.school.timezone }).format(new Date(ctx.expiresAt))}. Jangan teruskan ke orang lain.</p>
    </main>
  );
}

function LeaveForm({ token, today, onDone }: { token: string; today: string; onDone: () => void }) {
  const [kind, setKind] = useState<LeaveKind>('sakit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api('/links/leave', ActionLinkLeave, {
        method: 'POST',
        linkToken: token,
        body: { kind, startsOn: String(data.get('startsOn')), endsOn: String(data.get('endsOn')), reason: String(data.get('reason')) },
      });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const message = error instanceof ApiError ? (fieldError(error, 'reason') ?? fieldError(error, 'endsOn') ?? fieldError(error, 'startsOn') ?? error.message) : error ? 'Tidak bisa terhubung. Coba lagi.' : null;
  return (
    <form className={forms.form} onSubmit={(e) => void submit(e)}>
      <fieldset className={forms.field}>
        <legend className={forms.label}>Ajukan izin</legend>
        {(['sakit', 'izin'] as const).map((k) => (
          <label key={k} style={{ marginRight: 16 }}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} /> {LEAVE_KIND_LABELS[k]}
          </label>
        ))}
      </fieldset>
      <label className={forms.field}>
        <span className={forms.label}>Dari tanggal</span>
        <DateInput type="date" name="startsOn" defaultValue={today} required />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Sampai tanggal</span>
        <DateInput type="date" name="endsOn" defaultValue={today} required />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Alasan</span>
        <Textarea name="reason" rows={3} minLength={3} maxLength={500} required />
      </label>
      {message && (
        <p className={forms.error} role="alert">
          {message}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Mengirim…' : 'Kirim ke wali kelas'}
      </Button>
    </form>
  );
}

function LinkCard({ token, name }: { token: string; name: string }) {
  const [keys, setKeys] = useState<CardDeviceKeys | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function show(replace: boolean) {
    if (replace && !window.confirm(`Kartu ${name} di HP lain akan berhenti berlaku. Lanjutkan?`)) return;
    setBusy(true);
    setError(null);
    try {
      setKeys(await api('/links/card', CardDeviceKeys, { method: 'POST', linkToken: token, body: { replace } }));
      setElsewhere(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setElsewhere(true);
      else setError(err instanceof ApiError ? err.message : 'Tidak bisa terhubung. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="kartu">
      <h2 id="kartu">Kartu {name}</h2>
      {keys ? (
        <CardQr keys={keys} name={name} />
      ) : elsewhere ? (
        <>
          <p>Kartu sedang aktif di HP lain (misalnya HP {name} sendiri).</p>
          <div className={styles.actions}>
            <Button variant="secondary" disabled={busy} onClick={() => void show(true)}>
              Pindahkan kartu ke HP ini
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={() => void show(false)}>
            Tampilkan kartu
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

/**
 * GRB-10: someone not on the list of penjemput is at the gate. The parent sees their photo and
 * allows or refuses; the child waits at school until then.
 */
function LinkPickups({ token, timezone, firstName, initial }: { token: string; timezone: string; firstName: string; initial: LinkHeldPickup[] }) {
  const [pickups, setPickups] = useState(initial);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, decision: 'allow' | 'deny') {
    setBusy(true);
    setError(null);
    try {
      setPickups((await api(`/links/pickups/${id}`, LinkHeldPickups, { method: 'POST', linkToken: token, body: { decision } })).pickups);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terkirim. Periksa internet lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function photo(id: string) {
    try {
      const link = await api(`/links/pickups/${id}/photo`, PickupPhotoLink, { linkToken: token });
      setPhotos((p) => ({ ...p, [id]: link.url }));
    } catch {
      setError('Foto tidak bisa dibuka.');
    }
  }

  return (
    <section className={styles.card} aria-labelledby="jemput">
      <h2 id="jemput">Penjemputan hari ini</h2>
      {pickups.map((p) => (
        <div key={p.id}>
          <p>
            <strong>{p.pickupName}</strong> ingin menjemput {firstName} ({timeIn(timezone, p.requestedAt)}) · {EVENT_STATUS_LABELS[p.status]}
          </p>
          {photos[p.id] ? (
            // eslint-disable-next-line @next/next/no-img-element -- a 5-minute presigned link; next/image would cache it past expiry
            <img src={photos[p.id]} alt={`Foto ${p.pickupName}`} width={240} />
          ) : (
            p.status === 'held' && (
              <Button variant="secondary" onClick={() => void photo(p.id)}>
                Lihat foto penjemput
              </Button>
            )
          )}
          {p.status === 'held' && (
            <div className={styles.actions}>
              <Button disabled={busy} onClick={() => void decide(p.id, 'allow')}>
                Izinkan {firstName} pulang bersama {p.pickupName}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void decide(p.id, 'deny')}>
                Tolak
              </Button>
            </div>
          )}
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
