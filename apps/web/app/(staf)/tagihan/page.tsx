'use client';

import { InvoiceList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { dateLabel, INVOICE_STATUS_LABELS, monthLabel, rupiah } from '@/lib/billing';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';

/** Absah's monthly invoices to the school (BIL): Rp10.000 per active student, pro rata per day. */
export default function TagihanPage() {
  const { schoolId } = useWorkspace();
  const [list, setList] = useState<InvoiceList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/billing/invoices', InvoiceList, { schoolId })
      .then(setList)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat tagihan.'));
  }, [schoolId]);

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Tagihan Absah</h1>
      <p className={styles.muted}>Rp10.000 per siswa aktif per bulan, dihitung per hari. Tagihan terbit tanggal 1 untuk bulan sebelumnya.</p>
      {error && <p role="alert">{error}</p>}
      {!list && !error && <p role="status">Memuat…</p>}
      {list && list.items.length === 0 && <p className={styles.empty}>Belum ada tagihan.</p>}
      {list && list.items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bulan</th>
                <th className={styles.num}>Siswa</th>
                <th className={styles.num}>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link href={`/tagihan/${i.id}`}>{monthLabel(i.month)}</Link>
                  </td>
                  <td className={styles.num}>{i.studentCount}</td>
                  <td className={styles.num}>{rupiah(i.total)}</td>
                  <td>
                    <span className={i.status === 'paid' ? styles.badgeOk : styles.badgeWarn}>{INVOICE_STATUS_LABELS[i.status]}</span>
                    {i.status === 'issued' && <span className={styles.muted}> · jatuh tempo {dateLabel(i.dueOn)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
