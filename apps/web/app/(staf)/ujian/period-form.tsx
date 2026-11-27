'use client';

import { FeeTypeList } from '@absah/contracts';
import { Button, DateInput } from '@absah/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { periodProblem, type PeriodForm } from '@/lib/exam';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';

/**
 * The name, dates and rule of an exam period (UJN-01/02): the minimum attendance and/or the bills that must be paid.
 * Shared by "Ujian baru" and "Ubah aturan"; it only checks what the API checks too and hands the form to onSubmit.
 */
export function PeriodFormFields({ initial, submitLabel, busy, error, onSubmit, onEdit }: { initial: PeriodForm; submitLabel: string; busy: boolean; error: string | null; onSubmit: (form: PeriodForm) => void; onEdit?: () => void }) {
  const { schoolId } = useWorkspace();
  const [form, setForm] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [fees, setFees] = useState<FeeTypeList['items']>([]);

  // The fee types the paid rule can be limited to; a school without student billing simply has none to pick.
  useEffect(() => {
    if (!schoolId) return;
    api('/student-billing/fee-types', FeeTypeList, { schoolId }).then((r) => setFees(r.items)).catch(() => undefined);
  }, [schoolId]);

  const change = (fields: Partial<PeriodForm>) => {
    onEdit?.();
    setProblem(null);
    setForm((f) => ({ ...f, ...fields }));
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = periodProblem(form);
    if (found) return setProblem(found);
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} aria-label={submitLabel}>
      <label className={forms.field}>
        Nama ujian
        <input value={form.name} maxLength={80} placeholder="PTS Ganjil" onChange={(e) => change({ name: e.target.value })} />
      </label>
      <label className={forms.field}>
        Tanggal mulai
        <DateInput type="date" value={form.startsOn} onChange={(e) => change({ startsOn: e.target.value })} />
      </label>
      <label className={forms.field}>
        Tanggal selesai
        <DateInput type="date" value={form.endsOn} onChange={(e) => change({ endsOn: e.target.value })} />
      </label>
      <fieldset className={forms.field}>
        <legend>Syarat boleh ujian</legend>
        <label>
          <input type="checkbox" checked={form.useMin} onChange={(e) => change({ useMin: e.target.checked })} /> Kehadiran minimal
        </label>
        {form.useMin && (
          <>
            <label className={forms.field}>
              Persen kehadiran minimal
              <input inputMode="numeric" value={form.minText} maxLength={3} onChange={(e) => change({ minText: e.target.value })} />
            </label>
            <label>
              <input type="checkbox" checked={form.excusedCounts} onChange={(e) => change({ excusedCounts: e.target.checked })} /> Sakit dan izin dihitung hadir
            </label>
            <label className={forms.field}>
              Hitung kehadiran mulai (kosong = awal tahun ajaran)
              <DateInput type="date" value={form.attendanceFrom} onChange={(e) => change({ attendanceFrom: e.target.value })} />
            </label>
          </>
        )}
        <label>
          <input type="checkbox" checked={form.requirePaid} onChange={(e) => change({ requirePaid: e.target.checked })} /> Tagihan yang jatuh tempo sebelum ujian harus lunas
        </label>
        {form.requirePaid && fees.length > 0 && (
          <fieldset className={forms.field}>
            <legend>Jenis tagihan yang dihitung (kosong = semua)</legend>
            {fees.map((f) => (
              <label key={f.id}>
                <input type="checkbox" checked={form.feeTypeIds.includes(f.id)} onChange={(e) => change({ feeTypeIds: e.target.checked ? [...form.feeTypeIds, f.id] : form.feeTypeIds.filter((x) => x !== f.id) })} /> {f.name}
              </label>
            ))}
          </fieldset>
        )}
      </fieldset>
      {(problem ?? error) && (
        <p className={forms.error} role="alert">
          {problem ?? error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
