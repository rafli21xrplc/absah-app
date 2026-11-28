'use client';

import { BillingClassList, FeeTypeList, StudentBill, StudentBillList, type BillStatus } from '@absah/contracts';
import { Button, EmptyState, Select } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { dateLabel, rupiah } from '@/lib/billing';
import { BILL_STATUS_LABELS, billState, STUDENT_BILLING_MANAGING, STUDENT_BILLING_READING } from '@/lib/student-billing';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';

/** Tagihan siswa (TGH-01): the bills of the school, for the bendahara and admin to run, kepsek and wakasek to read. */
export default function TagihanSiswaPage() {
  const { hasRole } = useWorkspace();
  return (
    <IfCap name="student.billing" fallback={<p className={styles.main}>Tagihan siswa belum diaktifkan.</p>}>
      {hasRole(...STUDENT_BILLING_READING) ? <Bills /> : <p className={styles.main}>Halaman ini untuk bendahara dan pimpinan sekolah.</p>}
    </IfCap>
  );
}

function Bills() {
  const { schoolId, hasRole } = useWorkspace();
  const manage = hasRole(...STUDENT_BILLING_MANAGING);
  const [status, setStatus] = useState<BillStatus | ''>('open');
  const [overdue, setOverdue] = useState(false);
  const [feeTypeId, setFeeTypeId] = useState('');
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('');
  const [fees, setFees] = useState<FeeTypeList['items']>([]);
  const [classes, setClasses] = useState<BillingClassList['items']>([]);
  const [list, setList] = useState<StudentBillList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/student-billing/fee-types?includeInactive=true', FeeTypeList, { schoolId }).then((r) => setFees(r.items)).catch(() => undefined);
    api('/student-billing/classes', BillingClassList, { schoolId }).then((r) => setClasses(r.items)).catch(() => undefined);
  }, [schoolId]);

  const load = useCallback(() => {
    if (!schoolId) return;
    const q = new URLSearchParams({ limit: '200' });
    if (status) q.set('status', status);
    if (overdue) q.set('overdue', 'true');
    if (feeTypeId) q.set('feeTypeId', feeTypeId);
    if (classId) q.set('classId', classId);
    if (period.trim()) q.set('period', period.trim());
    api(`/student-billing/bills?${q}`, StudentBillList, { schoolId })
      .then((r) => {
        setError(null);
        setList(r);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat tagihan.'));
  }, [schoolId, status, overdue, feeTypeId, classId, period]);
  useEffect(load, [load]);

  async function cancel(bill: StudentBill) {
    const reason = window.prompt(`Alasan membatalkan tagihan ${bill.student.name} (${bill.title})`);
    if (reason === null) return;
    if (!reason.trim()) return setError('Tulis alasan membatalkan.');
    setError(null);
    try {
      await api(`/student-billing/bills/${bill.id}/void`, StudentBill, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { reason: reason.trim() } });
      load();
    } catch (err) {
      setError(err instanceof ApiError && err.body.details && (err.body.details as { reason?: string }).reason === 'has_payments' ? 'Tagihan yang sudah dibayar tidak bisa dibatalkan.' : err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal.');
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Tagihan siswa</h1>
      <p>
        <Link href="/tagihan-siswa/rekap">Rekap pembayaran</Link>
        {manage && (
          <>
            {' · '}
            <Link href="/tagihan-siswa/terbitkan">Terbitkan tagihan</Link>
            {' · '}
            <Link href="/tagihan-siswa/jenis">Jenis tagihan</Link>
          </>
        )}
      </p>
      <form className={styles.toolbar} aria-label="Saring tagihan" onSubmit={(e) => e.preventDefault()}>
        <label>
          Status{' '}
          <Select value={status} onChange={(e) => setStatus(e.target.value as BillStatus | '')}>
            <option value="">Semua</option>
            {(['open', 'paid', 'void'] as const).map((s) => (
              <option key={s} value={s}>
                {BILL_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Jenis{' '}
          <Select value={feeTypeId} onChange={(e) => setFeeTypeId(e.target.value)}>
            <option value="">Semua jenis</option>
            {fees.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Rombel{' '}
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Semua rombel</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          Periode <input value={period} maxLength={40} placeholder="2026-11" onChange={(e) => setPeriod(e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Hanya yang lewat jatuh tempo
        </label>
      </form>
      {error && <p role="alert">{error}</p>}
      {!list && !error && <p role="status">Memuat…</p>}
      {list && list.items.length === 0 && <EmptyState bare headingLevel="p" kind="search" title="Tidak ada tagihan yang cocok." />}
      {list && list.items.length > 0 && (
        <>
          <p className={styles.muted}>
            {list.items.length < list.total ? `Menampilkan ${list.items.length} dari ${list.total} tagihan.` : `${list.total} tagihan.`}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>Tagihan</th>
                  <th className={styles.num}>Total</th>
                  <th className={styles.num}>Terbayar</th>
                  <th>Jatuh tempo</th>
                  <th>Status</th>
                  {manage && <th />}
                </tr>
              </thead>
              <tbody>
                {list.items.map((b) => (
                  <tr key={b.id}>
                    <td>
                      {b.student.name} <span className={styles.muted}>· {b.student.className}</span>
                    </td>
                    <td>
                      {b.title} <span className={styles.muted}>· {b.feeType.name}</span>
                      {b.installments.length > 1 && <span className={styles.muted}> · {b.installments.length} cicilan</span>}
                    </td>
                    <td className={styles.num}>{rupiah(b.total)}</td>
                    <td className={styles.num}>{rupiah(b.paid)}</td>
                    <td>{dateLabel(b.dueOn)}</td>
                    <td>
                      <span className={b.status === 'paid' ? styles.badgeOk : b.status === 'void' ? styles.badge : b.overdue ? styles.badgeBad : styles.badgeWarn}>{billState(b)}</span>
                      {b.voidReason && <span className={styles.muted}> · {b.voidReason}</span>}
                    </td>
                    {manage && <td>{b.status === 'open' && b.paid === 0 && <Button variant="secondary" type="button" onClick={() => void cancel(b)}>Batalkan</Button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
