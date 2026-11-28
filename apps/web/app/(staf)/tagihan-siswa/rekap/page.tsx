'use client';

import { BillingRecap, FeeTypeList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { dateLabel, monthLabel, rupiah } from '@/lib/billing';
import { STUDENT_BILLING_READING } from '@/lib/student-billing';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import { DateInput, EmptyState, Select, LoadingState } from '@absah/ui';

/** Rekap pembayaran (TGH-04): what came in during a month and what is still owed per rombel. JSON only on the API for now. */
export default function RekapTagihanPage() {
  const { hasRole } = useWorkspace();
  return (
    <IfCap name="student.billing" fallback={<p className={styles.main}>Tagihan siswa belum diaktifkan.</p>}>
      {hasRole(...STUDENT_BILLING_READING) ? <Recap /> : <p className={styles.main}>Halaman ini untuk bendahara dan pimpinan sekolah.</p>}
    </IfCap>
  );
}

function Recap() {
  const { schoolId } = useWorkspace();
  const [month, setMonth] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [fees, setFees] = useState<FeeTypeList['items']>([]);
  const [loaded, setLoaded] = useState<{ key: string; data: BillingRecap } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const key = `${schoolId}|${month}|${feeTypeId}`;

  useEffect(() => {
    if (!schoolId) return;
    api('/student-billing/fee-types?includeInactive=true', FeeTypeList, { schoolId }).then((r) => setFees(r.items)).catch(() => undefined);
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId) return;
    const q = new URLSearchParams();
    if (month) q.set('month', month);
    if (feeTypeId) q.set('feeTypeId', feeTypeId);
    api(`/student-billing/recap${q.size ? `?${q}` : ''}`, BillingRecap, { schoolId })
      .then((data) => setLoaded({ key, data }))
      .catch((err: unknown) => setFailed({ key, message: err instanceof ApiError ? err.message : 'Tidak bisa memuat rekap.' }));
  }, [schoolId, month, feeTypeId, key]);

  // Only the answer to the current question is shown, never the previous month's while the next one loads.
  const recap = loaded?.key === key ? loaded.data : null;
  const error = failed?.key === key ? failed.message : null;

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/tagihan-siswa">
        ← Tagihan siswa
      </Link>
      <h1 className={styles.title}>Rekap pembayaran</h1>
      <form className={styles.toolbar} aria-label="Saring rekap" onSubmit={(e) => e.preventDefault()}>
        <label>
          Bulan <DateInput type="month" value={month || recap?.month || ''} onChange={(e) => setMonth(e.target.value)} />
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
      </form>
      {error && <p role="alert">{error}</p>}
      {!recap && !error && <LoadingState variant="table" />}
      {recap && (
        <>
          <section className={styles.section} aria-labelledby="masuk">
            <h2 id="masuk">Uang masuk, {monthLabel(recap.month)}</h2>
            <p>
              <strong>{rupiah(recap.received.amount)}</strong> dari {recap.received.count} pembayaran · VA {rupiah(recap.received.va)} · QRIS {rupiah(recap.received.qris)}
            </p>
            {recap.received.flagged > 0 && (
              <p className={styles.notice} role="status">
                {recap.received.flagged} pembayaran masuk tetapi tidak dihitung (cicilan sudah lunas atau tagihan dibatalkan). Periksa bersama penyedia pembayaran.
              </p>
            )}
            {recap.received.days.length === 0 ? (
              <EmptyState bare headingLevel="p" kind="empty" title="Belum ada pembayaran pada bulan ini." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th className={styles.num}>Pembayaran</th>
                      <th className={styles.num}>Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.received.days.map((d) => (
                      <tr key={d.date}>
                        <td>{dateLabel(d.date)}</td>
                        <td className={styles.num}>{d.count}</td>
                        <td className={styles.num}>{rupiah(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className={styles.section} aria-labelledby="tunggakan">
            <h2 id="tunggakan">Belum dibayar per rombel</h2>
            <p>
              Ditagih {rupiah(recap.bills.billed)} · terbayar {rupiah(recap.bills.paid)} · <strong>belum dibayar {rupiah(recap.bills.outstanding)}</strong>
              {recap.bills.overdue > 0 && <> · lewat jatuh tempo {rupiah(recap.bills.overdue)}</>}
            </p>
            {recap.bills.classes.length === 0 ? (
              <EmptyState bare headingLevel="p" kind="empty" title="Belum ada tagihan." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Rombel</th>
                      <th className={styles.num}>Tagihan</th>
                      <th className={styles.num}>Ditagih</th>
                      <th className={styles.num}>Terbayar</th>
                      <th className={styles.num}>Belum dibayar</th>
                      <th className={styles.num}>Lewat tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recap.bills.classes.map((c) => (
                      <tr key={c.classId}>
                        <td>{c.className}</td>
                        <td className={styles.num}>{c.count}</td>
                        <td className={styles.num}>{rupiah(c.billed)}</td>
                        <td className={styles.num}>{rupiah(c.paid)}</td>
                        <td className={styles.num}>{rupiah(c.outstanding)}</td>
                        <td className={styles.num}>{c.overdue > 0 ? <span className={styles.badgeBad}>{rupiah(c.overdue)}</span> : rupiah(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
