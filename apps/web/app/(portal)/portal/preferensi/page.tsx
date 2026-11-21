'use client';

import { NotificationPreferences, type MutableTemplateCode } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { LATE_CUTOFF_LABEL, mutedFrom, PREFERENCE_LABELS, receivedFrom, toggled } from '@/lib/preferences';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../portal.module.css';

interface Draft {
  received: Set<MutableTemplateCode>;
  noLate: boolean;
}

/**
 * Pusat preferensi (ORT-06): which WhatsApp messages the parent receives and whether late ones are held.
 * Choices are per school (a school has its own guardian record), so the page follows the active school;
 * the child picker at the top switches it for children at another school.
 */
export default function PortalPreferensi() {
  const { schoolId, me, hasRole } = useWorkspace();
  const schoolName = me.schools.find((s) => s.id === schoolId)?.name;
  const isParent = hasRole('orang_tua');
  const [saved, setSaved] = useState<NotificationPreferences | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // One key per save; a retry reuses it, any change to the choices makes a new one (CLAUDE.md rule 3).
  const [key, setKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!schoolId || !isParent) return;
    api('/portal/notification-preferences', NotificationPreferences, { schoolId })
      .then((p) => {
        setSaved(p);
        setDraft({ received: receivedFrom(p.mutedTypes), noLate: p.noLateMessages });
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat pengaturan. Periksa internet.'));
  }, [schoolId, isParent]);

  function change(next: Draft) {
    setDraft(next);
    setDone(false);
    setKey(newIdempotencyKey());
  }

  async function save() {
    if (!schoolId || !draft) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api('/portal/notification-preferences', NotificationPreferences, {
        method: 'PUT',
        schoolId,
        idempotencyKey: key,
        body: { mutedTypes: mutedFrom(draft.received), noLateMessages: draft.noLate },
      });
      setSaved(p);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak bisa menyimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link href="/portal">← Portal</Link>
      <h1 className={styles.title}>Pesan WhatsApp</h1>
      {schoolName && <p className={styles.eyebrow}>{schoolName}</p>}
      {!isParent ? (
        <p>Pengaturan ini untuk orang tua.</p>
      ) : (
        <>
          {error && <p role="alert">{error}</p>}
          {!draft && !error && <p role="status">Memuat…</p>}
          {draft && saved && (
            <form
              className={styles.card}
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <p>
                Dikirim ke <strong>{saved.phone ?? 'nomor yang belum diisi'}</strong>. Nomor diubah oleh sekolah.
              </p>
              <fieldset className={styles.fieldset}>
                <legend>Pesan yang ingin saya terima</legend>
                {(Object.keys(PREFERENCE_LABELS) as MutableTemplateCode[]).map((code) => (
                  <label key={code} className={styles.choice}>
                    <input type="checkbox" checked={draft.received.has(code)} onChange={() => change({ ...draft, received: toggled(draft.received, code) })} />
                    <span>{PREFERENCE_LABELS[code]}</span>
                  </label>
                ))}
              </fieldset>
              <label className={styles.choice}>
                <input type="checkbox" checked={draft.noLate} onChange={() => change({ ...draft, noLate: !draft.noLate })} />
                <span>Jangan kirim setelah pukul {LATE_CUTOFF_LABEL} (ditahan sampai pukul 06.00)</span>
              </label>
              <p className={styles.muted}>Pesan keselamatan, seperti penjemput yang tidak dikenal dan kode masuk, selalu dikirim.</p>
              <div className={styles.actions}>
                <Button type="submit" disabled={busy}>
                  Simpan
                </Button>
              </div>
              {done && <p role="status">Pengaturan tersimpan.</p>}
            </form>
          )}
          <IfCap name="portal.liaison">
            <p className={styles.muted}>Pesan buku penghubung mengikuti jam layanan sekolah.</p>
          </IfCap>
        </>
      )}
    </main>
  );
}
