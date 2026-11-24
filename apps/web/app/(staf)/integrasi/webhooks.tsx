'use client';

import { CreatedWebhook, Webhook, WebhookDeliveryList, WebhookList, WebhookTestQueued, WEBHOOK_EVENTS, type WebhookDelivery, type WebhookEventType } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { anyPending, DELIVERY_STATUS_LABELS, deliveryError, EVENT_LABELS, eventLabel, toggle, webhookInput } from '@/lib/integration';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import local from './integrasi.module.css';
import { SecretNotice } from './keys';

const SIGNATURE_EXAMPLE = `X-Absah-Signature: t=1800000000,v1=<hex>
v1 = HMAC-SHA256(secret, "<t>.<isi permintaan apa adanya>")`;

const POLL_MS = 3000;
const POLL_MAX = 20;

/** The last calls to one address, and the ping: the admin sees at once whether the receiver answers. */
function Activity({ hook, schoolId }: { hook: Webhook; schoolId: string }) {
  const [items, setItems] = useState<WebhookDelivery[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const testKey = useRef<string | null>(null);
  const polls = useRef(0);

  const load = useCallback(() => api(`/integrations/webhooks/${hook.id}/deliveries`, WebhookDeliveryList, { schoolId }).then((r) => r.items), [hook.id, schoolId]);
  const fail = (err: unknown) => setMessage(err instanceof ApiError ? err.message : 'Tidak terkirim. Periksa sinyal, lalu coba lagi.');

  useEffect(() => {
    if (!open) return;
    void load().then(setItems, fail);
  }, [open, load]);

  // While a call waits, ask again every few seconds (at most a minute), so "Menunggu" turns into the answer.
  useEffect(() => {
    if (!open || !items || !anyPending(items) || polls.current >= POLL_MAX) return;
    const timer = setTimeout(() => {
      polls.current += 1;
      void load().then(setItems, fail);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [open, items, load]);

  async function test() {
    testKey.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    try {
      await api(`/integrations/webhooks/${hook.id}/test`, WebhookTestQueued, { method: 'POST', schoolId, idempotencyKey: testKey.current });
      testKey.current = null;
      polls.current = 0;
      setOpen(true);
      setItems(await load());
    } catch (err) {
      if (err instanceof ApiError) testKey.current = null;
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={local.row}>
        <Button variant="secondary" disabled={busy || !hook.active} onClick={() => void test()}>
          {busy ? 'Mengirim…' : `Kirim tes ke ${hook.urlPreview}`}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? `Tutup riwayat ${hook.urlPreview}` : `Riwayat ${hook.urlPreview}`}
        </Button>
      </div>
      {!hook.active && <p className={styles.muted}>Nyalakan alamat ini untuk mengirim tes.</p>}
      {message && (
        <p className={forms.error} role="alert">
          {message}
        </p>
      )}
      {open && (
        <div aria-live="polite">
          {!items && !message && <p role="status">Memuat…</p>}
          {items?.length === 0 && <p className={styles.muted}>Belum ada pengiriman.</p>}
          <ul>
            {items?.map((d) => (
              <li key={d.id}>
                <span className={d.status === 'delivered' ? styles.badgeOk : d.status === 'failed' ? styles.badgeBad : styles.badgeWarn}>{DELIVERY_STATUS_LABELS[d.status]}</span> {eventLabel(d.eventType)} ·{' '}
                {new Date(d.createdAt).toLocaleString('id-ID')}
                {d.lastStatus !== null && d.status === 'delivered' ? ` · jawaban ${d.lastStatus}` : ''}
                {d.status === 'failed' ? ` · ${deliveryError(d.lastError)}` : ''}
                {d.attempts > 1 ? ` · ${d.attempts} percobaan` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

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
            <Activity hook={h} schoolId={schoolId} />
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
