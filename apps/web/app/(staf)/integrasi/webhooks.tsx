'use client';

import { CreatedWebhook, Webhook, WebhookList, WEBHOOK_EVENTS, type WebhookEventType } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { EVENT_LABELS, toggle, webhookInput } from '@/lib/integration';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import local from './integrasi.module.css';
import { SecretNotice } from './keys';

const SIGNATURE_EXAMPLE = `X-Absah-Signature: t=1800000000,v1=<hex>
v1 = HMAC-SHA256(secret, "<t>.<isi permintaan apa adanya>")`;

/** Webhook (PLT-09): where Absah posts the chosen events, signed with a secret shown once. */
export function Webhooks({ schoolId }: { schoolId: string }) {
  const [items, setItems] = useState<Webhook[] | null>(null);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEventType[]>([...WEBHOOK_EVENTS]);
  const [created, setCreated] = useState<CreatedWebhook | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const createKey = useRef<string | null>(null);

  const load = useCallback(() => api('/integrations/webhooks', WebhookList, { schoolId }).then((r) => r.items), [schoolId]);
  useEffect(() => {
    void load().then(setItems, (err: unknown) => setMessage(err instanceof ApiError ? err.message : 'Tidak bisa memuat webhook.'));
  }, [load]);

  const fail = (err: unknown) => setMessage(err instanceof ApiError ? err.message : 'Tidak terkirim. Periksa sinyal, lalu coba lagi.');

  async function create() {
    const input = webhookInput(url, events);
    if ('error' in input) return setMessage(input.error);
    createKey.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    try {
      setCreated(await api('/integrations/webhooks', CreatedWebhook, { method: 'POST', body: input, schoolId, idempotencyKey: createKey.current }));
      createKey.current = null;
      setUrl('');
      setItems(await load());
    } catch (err) {
      if (err instanceof ApiError) createKey.current = null;
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function patch(hook: Webhook, body: { active?: boolean; events?: WebhookEventType[] }) {
    setMessage(null);
    try {
      await api(`/integrations/webhooks/${hook.id}`, Webhook, { method: 'PATCH', body, schoolId, idempotencyKey: newIdempotencyKey() });
      setItems(await load());
    } catch (err) {
      fail(err);
    }
  }

  async function remove(hook: Webhook) {
    if (!window.confirm(`Hapus webhook ke ${hook.urlPreview}? Riwayat pengirimannya ikut terhapus.`)) return;
    setMessage(null);
    try {
      await api(`/integrations/webhooks/${hook.id}`, z.null(), { method: 'DELETE', schoolId, idempotencyKey: newIdempotencyKey() });
      setItems(await load());
    } catch (err) {
      fail(err);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="webhook">
      <h2 id="webhook">Webhook</h2>
      <p className={styles.muted}>
        Absah mengirim kabar ke alamat Anda saat kejadian terpilih terjadi. Isinya hanya id dan jumlah, tanpa nama siswa; sistem Anda mengambil rinciannya lewat kunci API. Alamat harus https dan bisa
        dijangkau dari internet. Pengiriman bisa terulang, jadi pakai <code>X-Absah-Delivery</code> untuk mengenali kiriman yang sama.
      </p>
      {created && <SecretNotice title="Webhook dibuat. Rahasia penandatangan:" secret={created.secret} onClose={() => setCreated(null)} />}

      <form
        className={forms.form}
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <label className={forms.field}>
          <span className={forms.label}>Alamat penerima</span>
          <input className={forms.input} type="url" value={url} onChange={(e) => { createKey.current = null; setUrl(e.target.value); }} placeholder="https://sistem-anda.example/absah" required />
          <span className={forms.hint}>Alamat disimpan terenkripsi dan setelah ini hanya tampil nama hostnya.</span>
        </label>
        <fieldset className={local.checks}>
          <legend className={forms.label}>Kejadian yang dikirim</legend>
          {WEBHOOK_EVENTS.map((e) => (
            <label key={e}>
              <input type="checkbox" checked={events.includes(e)} onChange={() => { createKey.current = null; setEvents(toggle(events, e)); }} /> {EVENT_LABELS[e]}
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={busy || url.trim() === '' || events.length === 0}>
          {busy ? 'Menyimpan…' : 'Tambah webhook'}
        </Button>
      </form>
      {message && (
        <p className={forms.error} role="alert">
          {message}
        </p>
      )}

      {!items && !message && <p role="status">Memuat…</p>}
      {items?.length === 0 && <p className={styles.muted}>Belum ada webhook.</p>}
      <ul>
        {items?.map((h) => (
          <li key={h.id} className={styles.notice}>
            <p>
              <strong>{h.urlPreview}</strong> · <span className={h.active ? styles.badgeOk : styles.badgeWarn}>{h.active ? 'Aktif' : 'Dimatikan'}</span>
            </p>
            <p className={styles.muted}>{h.events.map((e) => EVENT_LABELS[e]).join(' · ')}</p>
            <div className={local.row}>
              <Button variant="secondary" onClick={() => void patch(h, { active: !h.active })}>
                {h.active ? `Matikan ${h.urlPreview}` : `Aktifkan ${h.urlPreview}`}
              </Button>
              <Button variant="secondary" onClick={() => void remove(h)}>
                Hapus {h.urlPreview}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <details>
        <summary>Cara memeriksa tanda tangan</summary>
        <p className={styles.muted}>Hitung ulang HMAC dengan rahasia webhook, bandingkan, dan tolak bila waktunya (t) terlalu lama.</p>
        <pre className={local.snippet}>{SIGNATURE_EXAMPLE}</pre>
      </details>
    </section>
  );
}
