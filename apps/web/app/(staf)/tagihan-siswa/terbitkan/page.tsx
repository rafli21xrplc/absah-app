'use client';

import { BillingClassList, FeeTypeList, IssueBillsResult, MAX_INSTALLMENTS } from '@absah/contracts';
import { Button, Select } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { dateLabel, rupiah } from '@/lib/billing';
import { evenInstallments, issueProblem, issueSummary, parseRupiah, STUDENT_BILLING_MANAGING, type IssueForm } from '@/lib/student-billing';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';

/** Terbitkan tagihan (TGH-01/02): one bill per student of a rombel or a whole grade; repeating it creates nothing twice. */
export default function TerbitkanPage() {
  const { hasRole } = useWorkspace();
  return (
    <IfCap name="student.billing" fallback={<p className={styles.main}>Tagihan siswa belum diaktifkan.</p>}>
      {hasRole(...STUDENT_BILLING_MANAGING) ? <Issue /> : <p className={styles.main}>Halaman ini untuk bendahara dan admin.</p>}
    </IfCap>
  );
}

const EMPTY: IssueForm = { feeTypeId: '', period: '', amountText: '', target: 'class', classId: '', grade: '', parts: 1, dueOn: '' };

function Issue() {
  const { schoolId } = useWorkspace();
  const [fees, setFees] = useState<FeeTypeList['items']>([]);
  const [classes, setClasses] = useState<BillingClassList['items']>([]);
  const [form, setForm] = useState<IssueForm>(EMPTY);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/student-billing/fee-types', FeeTypeList, { schoolId }).then((r) => setFees(r.items)).catch(() => setError('Tidak bisa memuat jenis tagihan.'));
    api('/student-billing/classes', BillingClassList, { schoolId }).then((r) => setClasses(r.items)).catch(() => setError('Tidak bisa memuat rombel.'));
  }, [schoolId]);

  const change = (fields: Partial<IssueForm>) => {
    key.current = null; // a changed form is a new action
    setDone(null);
    setForm((f) => ({ ...f, ...fields }));
  };

  const fee = fees.find((f) => f.id === form.feeTypeId);
  const amount = form.amountText.trim() === '' ? (fee?.defaultAmount ?? null) : parseRupiah(form.amountText);
  const plan = useMemo(() => (form.parts > 1 && amount && form.dueOn ? evenInstallments(amount, form.parts, form.dueOn) : null), [form.parts, form.dueOn, amount]);
  const students = form.target === 'class' ? (classes.find((c) => c.id === form.classId)?.activeStudents ?? null) : classes.filter((c) => String(c.grade) === form.grade.trim()).reduce((n, c) => n + c.activeStudents, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = issueProblem(form) ?? (amount === null || amount < 1 ? 'Isi nominal; jenis ini belum punya nominal bawaan.' : null);
    if (problem) return setError(problem);
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const body = {
        feeTypeId: form.feeTypeId,
        period: form.period.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(form.amountText.trim() ? { amount } : {}),
        ...(plan ? { installments: plan } : { dueOn: form.dueOn }),
        target: form.target === 'class' ? { kind: 'class' as const, classId: form.classId } : { kind: 'grade' as const, grade: Number(form.grade) },
      };
      const result = await api('/student-billing/issue', IssueBillsResult, { method: 'POST', schoolId, idempotencyKey: key.current, body });
      setDone(issueSummary(result, rupiah));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/tagihan-siswa">
        ← Tagihan siswa
      </Link>
      <h1 className={styles.title}>Terbitkan tagihan</h1>
      <form onSubmit={(e) => void submit(e)} aria-label="Terbitkan tagihan">
        <label className={forms.field}>
          Jenis tagihan
          <Select value={form.feeTypeId} onChange={(e) => change({ feeTypeId: e.target.value })}>
            <option value="">Pilih jenis…</option>
            {fees.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({rupiah(f.defaultAmount)})
              </option>
            ))}
          </Select>
        </label>
        <label className={forms.field}>
          Periode
          <input value={form.period} maxLength={40} placeholder="2026-11 atau Semester 1" onChange={(e) => change({ period: e.target.value })} />
          <span className={forms.hint}>Dengan periode yang sama, siswa yang sudah punya tagihan ini dilewati.</span>
        </label>
        <label className={forms.field}>
          Judul di tagihan (boleh dikosongkan)
          <input value={title} maxLength={120} onChange={(e) => { key.current = null; setTitle(e.target.value); }} />
        </label>
        <label className={forms.field}>
          Nominal per siswa (kosongkan untuk memakai nominal bawaan)
          <input inputMode="numeric" value={form.amountText} placeholder={fee ? String(fee.defaultAmount) : ''} onChange={(e) => change({ amountText: e.target.value })} />
        </label>
        <fieldset className={forms.field}>
          <legend>Untuk siapa</legend>
          <label>
            <input type="radio" name="target" checked={form.target === 'class'} onChange={() => change({ target: 'class' })} /> Satu rombel
          </label>
          <label>
            <input type="radio" name="target" checked={form.target === 'grade'} onChange={() => change({ target: 'grade' })} /> Satu angkatan
          </label>
        </fieldset>
        {form.target === 'class' ? (
          <label className={forms.field}>
            Rombel
            <Select value={form.classId} onChange={(e) => change({ classId: e.target.value })}>
              <option value="">Pilih rombel…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.activeStudents} siswa)
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <label className={forms.field}>
            Kelas (angkatan)
            <input inputMode="numeric" value={form.grade} maxLength={2} placeholder="8" onChange={(e) => change({ grade: e.target.value })} />
          </label>
        )}
        {students !== null && students > 0 && <p className={styles.muted}>{students} siswa aktif akan ditagih.</p>}
        <label className={forms.field}>
          Dibayar dalam
          <Select value={form.parts} onChange={(e) => change({ parts: Number(e.target.value) })}>
            <option value={1}>Sekali bayar</option>
            {Array.from({ length: MAX_INSTALLMENTS - 1 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} cicilan, sebulan sekali
              </option>
            ))}
          </Select>
        </label>
        <label className={forms.field}>
          {form.parts > 1 ? 'Jatuh tempo cicilan pertama' : 'Jatuh tempo'}
          <input type="date" value={form.dueOn} onChange={(e) => change({ dueOn: e.target.value })} />
        </label>
        {plan && (
          <ol aria-label="Rencana cicilan">
            {plan.map((p, i) => (
              <li key={i}>
                {rupiah(p.amount)} · {dateLabel(p.dueOn)}
              </li>
            ))}
          </ol>
        )}
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        {done && <p role="status">{done}</p>}
        <Button type="submit" disabled={busy}>
          Terbitkan
        </Button>
      </form>
    </main>
  );
}
