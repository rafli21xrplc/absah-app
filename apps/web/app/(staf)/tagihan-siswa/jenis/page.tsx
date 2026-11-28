'use client';

import { FEE_KINDS, FeeType, FeeTypeList, type FeeKind } from '@absah/contracts';
import { Button, EmptyState, Select } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { rupiah } from '@/lib/billing';
import { FEE_KIND_LABELS, parseRupiah, STUDENT_BILLING_MANAGING } from '@/lib/student-billing';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';

/** Jenis tagihan (TGH-01): SPP, kegiatan and the like, named by the school. Switched off, never deleted: bills cite them. */
export default function JenisTagihanPage() {
  const { hasRole } = useWorkspace();
  return (
    <IfCap name="student.billing" fallback={<p className={styles.main}>Tagihan siswa belum diaktifkan.</p>}>
      {hasRole(...STUDENT_BILLING_MANAGING) ? <Types /> : <p className={styles.main}>Halaman ini untuk bendahara dan admin.</p>}
    </IfCap>
  );
}

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');

function Types() {
  const { schoolId } = useWorkspace();
  const [items, setItems] = useState<FeeType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FeeKind>('spp');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/student-billing/fee-types?includeInactive=true', FeeTypeList, { schoolId })
      .then((r) => setItems(r.items))
      .catch(() => setError('Tidak bisa memuat jenis tagihan.'));
  }, [schoolId]);
  useEffect(load, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const value = amount.trim() === '' ? 0 : parseRupiah(amount);
    if (name.trim().length < 2) return setError('Nama jenis tagihan minimal 2 huruf.');
    if (value === null) return setError('Nominal harus angka rupiah, tanpa koma.');
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      await api('/student-billing/fee-types', FeeType, { method: 'POST', schoolId, idempotencyKey: key.current, body: { name, kind, defaultAmount: value } });
      key.current = null;
      setName('');
      setAmount('');
      load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function update(fee: FeeType, fields: { active?: boolean; defaultAmount?: number }) {
    setError(null);
    try {
      await api(`/student-billing/fee-types/${fee.id}`, FeeType, { method: 'PATCH', schoolId, idempotencyKey: newIdempotencyKey(), body: fields });
      load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/tagihan-siswa">
        ← Tagihan siswa
      </Link>
      <h1 className={styles.title}>Jenis tagihan</h1>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {items.length === 0 && <EmptyState bare headingLevel="p" kind="empty" title="Belum ada jenis tagihan." />}
      <ul className={ui.sessions}>
        {items.map((f) => (
          <li key={f.id} className={ui.student} aria-label={f.name}>
            <span className={ui.studentName}>
              {f.name} ({rupiah(f.defaultAmount)})
            </span>
            <span>{FEE_KIND_LABELS[f.kind]}</span>
            {!f.active && <span className={styles.badgeWarn}>Nonaktif</span>}
            <span>
              <Button variant="secondary" type="button" onClick={() => void update(f, { active: !f.active })}>
                {f.active ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>{' '}
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  const next = window.prompt(`Nominal baru untuk ${f.name} (rupiah)`, String(f.defaultAmount));
                  if (next === null) return;
                  const value = parseRupiah(next);
                  if (value === null) return setError('Nominal harus angka rupiah, tanpa koma.');
                  void update(f, { defaultAmount: value });
                }}
              >
                Ubah nominal
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.muted}>Mengubah nominal tidak mengubah tagihan yang sudah terbit.</p>
      <form onSubmit={(e) => void create(e)} aria-label="Jenis tagihan baru">
        <h2>Jenis baru</h2>
        <label className={forms.field}>
          Nama jenis tagihan
          <input value={name} maxLength={80} onChange={(e) => { key.current = null; setName(e.target.value); }} />
        </label>
        <label className={forms.field}>
          Golongan
          <Select value={kind} onChange={(e) => setKind(e.target.value as FeeKind)}>
            {FEE_KINDS.map((k) => (
              <option key={k} value={k}>
                {FEE_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </label>
        <label className={forms.field}>
          Nominal bawaan (rupiah)
          <input inputMode="numeric" value={amount} placeholder="250.000" onChange={(e) => { key.current = null; setAmount(e.target.value); }} />
        </label>
        <Button type="submit" disabled={busy}>
          Tambah jenis
        </Button>
      </form>
    </main>
  );
}
