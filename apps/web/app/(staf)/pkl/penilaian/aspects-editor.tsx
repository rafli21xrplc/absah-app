'use client';

import { PklAssessmentAspectList } from '@absah/contracts';
import { Button, EmptyState, Input } from '@absah/ui';
import { useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { aspectsRequest, draftsFrom, moveRow, PKL_ASPECT_MAX, type AspectDraft } from '@/lib/pkl-assessment';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';

/** The aspects the school grades PKL students on (PKL-04): the whole list in form order, saved as one. Managers only. */
export function AspectsEditor({ schoolId, aspects, onSaved }: { schoolId: string; aspects: PklAssessmentAspectList['items']; onSaved: () => void }) {
  const [rows, setRows] = useState<AspectDraft[]>(() => draftsFrom(aspects));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const key = useRef<string | null>(null);

  const edit = (index: number, change: Partial<AspectDraft>) => setRows((all) => all.map((r, i) => (i === index ? { ...r, ...change } : r)));

  async function save() {
    const request = aspectsRequest(rows);
    if ('error' in request) {
      setMessage({ ok: false, text: request.error });
      return;
    }
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    try {
      const saved = await api('/pkl/assessment-aspects', PklAssessmentAspectList, { method: 'PUT', schoolId, idempotencyKey: key.current, body: request.body });
      key.current = null;
      setRows(draftsFrom(saved.items));
      setMessage({ ok: true, text: 'Aspek penilaian tersimpan.' });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) key.current = null; // an answer ends the action; a lost reply keeps the key
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="aspek">
      <h2 id="aspek">Aspek penilaian</h2>
      <p className={styles.muted}>Pembimbing industri menilai setiap aspek dengan angka 0-100. Bobot menentukan seberapa besar aspek itu dalam nilai akhir. Penilaian yang sudah diberikan tidak berubah bila aspek diubah.</p>
      {rows.length === 0 && <EmptyState bare headingLevel="p" kind="empty" title="Belum ada aspek.">Tambahkan minimal satu supaya pembimbing industri bisa menilai.</EmptyState>}
      <ul className={styles.risk}>
        {rows.map((r, i) => (
          <li key={r.id ?? `new-${i}`} aria-label={`Aspek ${i + 1}`}>
            <div className={styles.toolbar}>
              <label className={forms.field}>
                <span className={forms.label}>Nama aspek {i + 1}</span>
                <Input value={r.name} maxLength={80} onChange={(e) => edit(i, { name: e.target.value })} />
              </label>
              <label className={forms.field}>
                <span className={forms.label}>Bobot aspek {i + 1}</span>
                <Input type="number" min={1} max={10} value={r.weight} onChange={(e) => edit(i, { weight: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
              </label>
            </div>
            <label className={forms.field}>
              <span className={forms.label}>Penjelasan aspek {i + 1} (boleh kosong)</span>
              <Input value={r.description} maxLength={300} onChange={(e) => edit(i, { description: e.target.value })} />
            </label>
            <div className={styles.toolbar}>
              <Button variant="secondary" disabled={i === 0} onClick={() => setRows((all) => moveRow(all, i, -1))}>
                Naik
              </Button>
              <Button variant="secondary" disabled={i === rows.length - 1} onClick={() => setRows((all) => moveRow(all, i, 1))}>
                Turun
              </Button>
              <Button variant="secondary" onClick={() => setRows((all) => all.filter((_, n) => n !== i))}>
                Hapus
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.toolbar}>
        <Button variant="secondary" disabled={rows.length >= PKL_ASPECT_MAX} onClick={() => setRows((all) => [...all, { name: '', description: '', weight: 1 }])}>
          Tambah aspek
        </Button>
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? 'Menyimpan…' : 'Simpan aspek'}
        </Button>
      </div>
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={message.ok ? styles.muted : undefined}>
          {message.text}
        </p>
      )}
    </section>
  );
}
