'use client';

import { InvoiceDetail, Payment, PaymentList, type PaymentMethod } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import QRCode from 'qrcode';
import { use, useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { BILLING_PAYERS, dateLabel, groupDigits, INVOICE_STATUS_LABELS, monthLabel, PAYMENT_STATUS_LABELS, rupiah, share } from '@/lib/billing';
import { timeIn } from '@/lib/gate';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import gate from '../../gerbang/gerbang.module.css';

/** Polls faster while the gateway opens the VA/QR, slower while waiting for the money. */
const POLL_OPENING_MS = 2000;
const POLL_WAITING_MS = 10_000;

function InvoiceView({ id }: { id: string }) {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const payer = hasRole(...BILLING_PAYERS);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [qr, setQr] = useState<{ text: string; src: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => (schoolId ? Promise.all([api(`/billing/invoices/${id}`, InvoiceDetail, { schoolId }), api(`/billing/invoices/${id}/payments`, PaymentList, { schoolId })]) : Promise.resolve(null)),
    [schoolId, id],
  );
  const show = useCallback((data: [InvoiceDetail, PaymentList] | null) => {
    if (!data) return;
    setInvoice(data[0]);
    setPayment(data[1].items[0] ?? null);
  }, []);

  useEffect(() => {
    load()
      .then(show)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat tagihan.'));
  }, [load, show]);

  // Keep the screen current while a payment is open: the worker opens it, the gateway reports the money.
  const open = invoice?.status === 'issued' && (payment?.status === 'requested' || payment?.status === 'pending');
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => void load().then(show).catch(() => undefined), payment?.status === 'requested' ? POLL_OPENING_MS : POLL_WAITING_MS);
    return () => clearInterval(timer);
  }, [open, payment?.status, load, show]);

  useEffect(() => {
    let live = true;
    const text = payment?.status === 'pending' ? payment.qrString : null;
    if (!text) return;
    void QRCode.toDataURL(text, { margin: 1, width: 320 }).then((src) => {
      if (live) setQr({ text, src });
    });
    return () => {
      live = false;
    };
  }, [payment]);

  async function pay(method: PaymentMethod) {
    if (!schoolId) return;
    setBusy(true);
    setError(null);
    try {
      setPayment(await api(`/billing/invoices/${id}/payments`, Payment, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { method } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Pembayaran belum bisa dibuat. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/tagihan">
        ← Semua tagihan
      </Link>
      <h1 className={styles.title}>Tagihan {invoice ? monthLabel(invoice.month) : ''}</h1>
      {error && <p role="alert">{error}</p>}
      {!invoice && !error && <p role="status">Memuat…</p>}
      {invoice && (
        <>
          <div className={styles.counts}>
            <p className={styles.count}>
              <strong>{rupiah(invoice.total)}</strong> {INVOICE_STATUS_LABELS[invoice.status].toLowerCase()}
            </p>
            <p className={styles.count}>
              <strong>{invoice.studentCount}</strong> siswa
            </p>
          </div>
          <p className={styles.muted}>
            {rupiah(invoice.unitPrice)} × {invoice.billedDays} hari-siswa ÷ {invoice.daysInMonth} hari
            {invoice.exemptDays > 0 ? `, ${invoice.exemptDays} hari libur akhir tahun tidak ditagih` : ''}. Dibulatkan di total.
            {invoice.status === 'issued' && ` Jatuh tempo ${dateLabel(invoice.dueOn)}.`}
          </p>

          {invoice.status === 'issued' && (
            <section className={styles.section} aria-labelledby="bayar">
              <h2 id="bayar">Pembayaran</h2>
              {payment && (
                <div role="status">
                  <p>
                    {payment.method === 'va' ? 'Virtual Account' : 'QRIS'}: {PAYMENT_STATUS_LABELS[payment.status]}
                  </p>
                  {payment.status === 'pending' && payment.vaNumber && (
                    <p>
                      {payment.vaBank} <strong data-testid="va-number">{groupDigits(payment.vaNumber)}</strong> · {rupiah(payment.amount)}
                    </p>
                  )}
                  {payment.status === 'pending' && qr && qr.text === payment.qrString && (
                    // eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimize
                    <img className={gate.qr} src={qr.src} alt="QRIS pembayaran tagihan" />
                  )}
                  {payment.status === 'pending' && payment.expiresAt && <p className={styles.muted}>Bayar sebelum pukul {timeIn(timezone, payment.expiresAt)} besok.</p>}
                </div>
              )}
              {payer ? (
                <div className={styles.rowActions}>
                  <Button disabled={busy || payment?.status === 'requested'} onClick={() => void pay('va')}>
                    Bayar lewat Virtual Account
                  </Button>
                  <Button variant="secondary" disabled={busy || payment?.status === 'requested'} onClick={() => void pay('qris')}>
                    Bayar lewat QRIS
                  </Button>
                </div>
              ) : (
                <p className={styles.muted}>Pembayaran dilakukan oleh admin sekolah.</p>
              )}
            </section>
          )}
          {invoice.status === 'paid' && invoice.paidAt && <p role="status">Lunas pada {dateLabel(invoice.paidAt.slice(0, 10))}. Terima kasih.</p>}

          <section className={styles.section} aria-labelledby="rincian">
            <h2 id="rincian">Rincian per siswa</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>NISN</th>
                    <th className={styles.num}>Hari</th>
                    <th className={styles.num}>Biaya</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((l, i) => (
                    <tr key={l.studentId ?? i}>
                      <td>{l.name ?? 'Siswa terhapus'}</td>
                      <td>{l.nisn ?? '-'}</td>
                      <td className={styles.num}>{l.days}</td>
                      <td className={styles.num}>{share(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <InvoiceView id={id} />;
}
