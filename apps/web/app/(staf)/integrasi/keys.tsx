'use client';

import { API_KEY_DEFAULT_RATE, API_KEY_SCOPES, ApiKey, ApiKeyList, CreatedApiKey, type ApiKeyScope } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { keyState, KEY_STATE_LABELS, parseRate, SCOPE_LABELS, toggle } from '@/lib/integration';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import local from './integrasi.module.css';

const day = (timezone: string, iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** A secret that is shown once; closing it is the only way to see it go. */
export function SecretNotice({ title, secret, onClose }: { title: string; secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.notice} role="status">
      <p>
        <strong>{title}</strong>
      </p>
      <p>Salin sekarang dan simpan di tempat aman. Setelah ditutup, tidak bisa dilihat lagi; bila hilang, buat yang baru.</p>
      <code className={local.secret}>{secret}</code>
      <div className={local.row}>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(secret).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          {copied ? 'Tersalin' : 'Salin'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Sudah saya simpan
        </Button>
      </div>
    </div>
  );
}

/** Kunci API (PLT-09): the admin makes and revokes keys for systems that read the school's attendance. */
export function Keys({ schoolId, timezone }: { schoolId: string; timezone: string }) {
  const [items, setItems] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>([...API_KEY_SCOPES]);
  const [rate, setRate] = useState(String(API_KEY_DEFAULT_RATE));
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const createKey = useRef<string | null>(null);

  const load = useCallback(() => api('/integrations/api-keys', ApiKeyList, { schoolId }).then((r) => r.items), [schoolId]);
  useEffect(() => {
    void load().then(setItems, (err: unknown) => setMessage(err instanceof ApiError ? err.message : 'Tidak bisa memuat kunci.'));
  }, [load]);

  async function create() {
    const parsed = parseRate(rate);
    if ('error' in parsed) return setMessage(parsed.error);
    createKey.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    try {
      const made = await api('/integrations/api-keys', CreatedApiKey, { method: 'POST', body: { name: name.trim(), scopes, rateLimitPerMinute: parsed.rate }, schoolId, idempotencyKey: createKey.current });
      createKey.current = null;
      setCreated(made);
      setName('');
      setItems(await load());
    } catch (err) {
      if (err instanceof ApiError) createKey.current = null; // an answer ends the action; a lost reply keeps the key
      setMessage(err instanceof ApiError ? err.message : 'Tidak terkirim. Periksa sinyal, lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: ApiKey) {
    if (!window.confirm(`Cabut kunci "${key.name}"? Sistem yang memakainya langsung ditolak.`)) return;
    setMessage(null);
    try {
      await api(`/integrations/api-keys/${key.id}/revoke`, ApiKey, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey() });
      setItems(await load());
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Tidak terkirim. Periksa sinyal, lalu coba lagi.');
    }
  }

  return (
    <section className={styles.section} aria-labelledby="kunci">
      <h2 id="kunci">Kunci API</h2>
      <p className={styles.muted}>
        Untuk sistem lain yang membaca presensi harian sekolah, misalnya dasbor dinas atau aplikasi sekolah. Kunci hanya memberi id dan status, tanpa nama siswa, dan dikirim dari server ke server:
        jangan dipasang di aplikasi atau halaman web.
      </p>
      {created && <SecretNotice title={`Kunci "${created.name}" dibuat`} secret={created.key} onClose={() => setCreated(null)} />}

      <form
        className={forms.form}
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className={forms.field}>
          <span className={forms.label}>Nama kunci</span>
          <input className={forms.input} value={name} maxLength={60} onChange={(e) => { createKey.current = null; setName(e.target.value); }} placeholder="Misalnya: Dasbor Dinas" required />
        </label>
        <fieldset className={local.checks}>
          <legend className={forms.label}>Izin</legend>
          {API_KEY_SCOPES.map((s) => (
            <label key={s}>
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => { createKey.current = null; setScopes(toggle(scopes, s)); }} /> {SCOPE_LABELS[s]}
            </label>
          ))}
        </fieldset>
        <label className={forms.field}>
          <span className={forms.label}>Batas permintaan per menit</span>
          <input className={forms.input} inputMode="numeric" value={rate} onChange={(e) => { createKey.current = null; setRate(e.target.value); }} />
        </label>
        <Button type="submit" disabled={busy || name.trim().length < 2 || scopes.length === 0}>
          {busy ? 'Membuat…' : 'Buat kunci'}
        </Button>
      </form>
      {message && (
        <p className={forms.error} role="alert">
          {message}
        </p>
      )}

      {!items && !message && <p role="status">Memuat…</p>}
      {items?.length === 0 && <p className={styles.muted}>Belum ada kunci.</p>}
      <ul>
        {items?.map((k) => (
          <li key={k.id} className={styles.notice}>
            <p>
              <strong>{k.name}</strong> · <span className={k.revokedAt ? styles.badgeBad : styles.badgeOk}>{KEY_STATE_LABELS[keyState(k)]}</span>
            </p>
            <p className={styles.muted}>
              {k.rateLimitPerMinute} permintaan per menit · dibuat {day(timezone, k.createdAt)} · {k.lastUsedAt ? `terakhir dipakai ${day(timezone, k.lastUsedAt)}` : 'belum pernah dipakai'}
            </p>
            {!k.revokedAt && (
              <Button variant="secondary" onClick={() => void revoke(k)}>
                Cabut kunci {k.name}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
