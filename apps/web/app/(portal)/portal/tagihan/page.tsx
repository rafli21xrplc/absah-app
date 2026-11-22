'use client';

import { MyBillsList, StudentPayment, type BillInstallment, type PaymentMethod, type StudentBill } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { dateLabel, groupDigits, PAYMENT_STATUS_LABELS, rupiah } from '@/lib/billing';
import { timeIn } from '@/lib/gate';
import { billState, hasLiveCharge, nextInstallment } from '@/lib/student-billing';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../portal.module.css';

/** Polls faster while the gateway opens the VA/QR, slower while waiting for the money. */
const POLL_OPENING_MS = 2000;
const POLL_WAITING_MS = 10_000;

/** Tagihan sekolah (TGH-03): a parent (or the student) sees the bills of their own children and pays an installment by VA or QRIS. */
export default function PortalTagihan() {
  return (
    <main className={styles.main}>
      <Link href="/portal">← Portal</Link>
      <h1 className={styles.title}>Tagihan sekolah</h1>
      <IfCap name="student.billing" fallback={<p>Sekolah belum memakai tagihan online.</p>}>
        <Bills />
      </IfCap>
    </main>
  );
}

/** Bills grouped per child, those still to pay first. */
function groupByChild(bills: StudentBill[]): { key: string; name: string; className: string; open: StudentBill[]; paid: StudentBill[] }[] {
  const groups = new Map<string, { key: string; name: string; className: string; open: StudentBill[]; paid: StudentBill[] }>();
  for (const b of bills) {
    const key = `${b.student.name}|${b.student.className}`;
    const g = groups.get(key) ?? { key, name: b.student.name, className: b.student.className, open: [], paid: [] };
    (b.status === 'open' ? g.open : g.paid).push(b);
    groups.set(key, g);
  }
  return [...groups.values()];
}

function Bills() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [list, setList] = useState<MyBillsList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return Promise.resolve();
    return api('/student-billing/mine', MyBillsList, { schoolId })
      .then((r) => {
        setError(null);
        setList(r);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat tagihan.'));
  }, [schoolId]);
  useEffect(() => {
    void load();
  }, [load]);

  // The worker opens the charge, the gateway reports the money: keep the screen current while one is open.
  const charges = list?.items.flatMap((b) => b.installments.filter(hasLiveCharge)) ?? [];
  const opening = charges.some((i) => i.payment?.status === 'requested');
  useEffect(() => {
    if (charges.length === 0) return;
    const timer = setInterval(() => void load(), opening ? POLL_OPENING_MS : POLL_WAITING_MS);
    return () => clearInterval(timer);
  }, [charges.length, opening, load]);

  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!list && !error && <p role="status">Memuat…</p>}
      {list && list.items.length === 0 && <p>Belum ada tagihan.</p>}
      {groupByChild(list?.items ?? []).map((g) => (
        <section key={g.key} className={styles.card} aria-label={`Tagihan ${g.name.split(/\s+/)[0]}`}>
          <h2>
            {g.name.split(/\s+/)[0]} <span className={styles.muted}>· {g.className}</span>
          </h2>
          {g.open.length === 0 && <p>Tidak ada tagihan yang harus dibayar.</p>}
          {g.open.map((b) => (
            <Bill key={b.id} bill={b} schoolId={schoolId} timezone={timezone} onChange={load} />
          ))}
          {g.paid.length > 0 && (
            <details>
              <summary>Sudah lunas ({g.paid.length})</summary>
              <ul>
                {g.paid.map((b) => (
                  <li key={b.id}>
                    {b.title} · {rupiah(b.total)} · lunas {b.paidAt ? dateLabel(b.paidAt.slice(0, 10)) : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
    </>
  );
}

function Bill({ bill, schoolId, timezone, onChange }: { bill: StudentBill; schoolId: string | null; timezone: string; onChange: () => Promise<void> | void }) {
  const next = nextInstallment(bill);
  return (
    <article aria-label={bill.title}>
      <h3>{bill.title}</h3>
      <p>
        {rupiah(bill.total)} · jatuh tempo {dateLabel(bill.dueOn)} ·{' '}
        <span className={bill.overdue ? `${styles.status} ${styles.statusA}` : undefined}>{billState(bill)}</span>
      </p>
      {bill.installments.length > 1 && (
        <ol aria-label="Cicilan">
          {bill.installments.map((i) => (
            <li key={i.id}>
              Cicilan {i.number}: {rupiah(i.amount)} · {dateLabel(i.dueOn)} · {i.paidAt ? 'lunas' : 'belum dibayar'}
            </li>
          ))}
        </ol>
      )}
      {next && <Pay installment={next} single={bill.installments.length === 1} schoolId={schoolId} timezone={timezone} onChange={onChange} />}
    </article>
  );
}

function Pay({ installment, single, schoolId, timezone, onChange }: { installment: BillInstallment; single: boolean; schoolId: string | null; timezone: string; onChange: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ text: string; src: string } | null>(null);
  const payment = installment.payment;
  const live = hasLiveCharge(installment);

  useEffect(() => {
    let alive = true;
    const text = payment?.status === 'pending' ? payment.qrString : null;
    if (!text) return;
    void QRCode.toDataURL(text, { margin: 1, width: 320 }).then((src) => {
      if (alive) setQr({ text, src });
    });
    return () => {
      alive = false;
    };
  }, [payment]);

  async function pay(method: PaymentMethod) {
    setBusy(true);
    setError(null);
    try {
      await api(`/student-billing/installments/${installment.id}/payments`, StudentPayment, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { method } });
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p>
        <strong>{single ? 'Yang harus dibayar' : `Cicilan ${installment.number}`}: {rupiah(installment.amount)}</strong>
      </p>
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
            <img className={styles.qr} src={qr.src} alt="QRIS pembayaran tagihan" />
          )}
          {payment.status === 'pending' && payment.expiresAt && <p className={styles.muted}>Bayar sebelum pukul {timeIn(timezone, payment.expiresAt)}.</p>}
          {(payment.status === 'expired' || payment.status === 'failed') && <p className={styles.muted}>Pembayaran sebelumnya tidak jadi. Minta yang baru di bawah.</p>}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {!live && (
        <div className={styles.actions}>
          <Button disabled={busy} onClick={() => void pay('va')}>
            Bayar lewat Virtual Account
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void pay('qris')}>
            Bayar lewat QRIS
          </Button>
        </div>
      )}
    </div>
  );
}
