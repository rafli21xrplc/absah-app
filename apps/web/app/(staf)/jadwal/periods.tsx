'use client';

import { DAY_NAMES, SchedulePeriodsResponse } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import page from './jadwal.module.css';

type Period = { number: number; startsAt: string; endsAt: string };
const WEEK = [1, 2, 3, 4, 5, 6];

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** `count` back-to-back periods of `minutes` from `start`. */
export function generatePeriods(start: string, minutes: number, count: number): Period[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    startsAt: toTime(toMinutes(start) + i * minutes),
    endsAt: toTime(toMinutes(start) + (i + 1) * minutes),
  }));
}

/** Jam pelajaran per weekday. Saving replaces all days; a day without rows has no lessons. */
export function PeriodsEditor({ initial, canEdit, onSaved }: { initial: SchedulePeriodsResponse; canEdit: boolean; onSaved: () => Promise<void> }) {
  const { schoolId } = useWorkspace();
  const [days, setDays] = useState<Record<number, Period[]>>(() => Object.fromEntries(initial.days.map((d) => [d.day, d.periods])));
  const [start, setStart] = useState('07:00');
  const [minutes, setMinutes] = useState(40);
  const [count, setCount] = useState(8);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const saveKey = useRef<string | null>(null);

  const edit = (day: number, next: Period[]) => {
    saveKey.current = null;
    setMessage(null);
    setDays((prev) => ({ ...prev, [day]: next }));
  };
  const fillWeekdays = () => {
    for (const day of [1, 2, 3, 4, 5]) edit(day, generatePeriods(start, minutes, count));
  };

  async function save() {
    saveKey.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    const body = { days: WEEK.filter((d) => (days[d] ?? []).length > 0).map((day) => ({ day, periods: days[day] ?? [] })) };
    try {
      await api('/schedule/periods', SchedulePeriodsResponse, { method: 'PUT', body, schoolId, idempotencyKey: saveKey.current });
      saveKey.current = null;
      setMessage({ ok: true, text: 'Jam pelajaran tersimpan.' });
      await onSaved();
    } catch (err) {
      const details = err instanceof ApiError && Array.isArray(err.body.details) ? (err.body.details as { message?: string }[]) : [];
      const first = details.find((d) => typeof d.message === 'string')?.message;
      setMessage({ ok: false, text: first ?? (err instanceof ApiError ? err.message : 'Tidak bisa menyimpan. Coba lagi.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      {canEdit && (
        <div className={page.editor}>
          <strong>Isi cepat Senin–Jumat</strong>
          <div className={page.row}>
            <label className={forms.field}>
              <span className={forms.label}>Mulai</span>
              <input className={forms.input} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className={forms.field}>
              <span className={forms.label}>Menit per jam</span>
              <input className={forms.input} type="number" min={20} max={90} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </label>
            <label className={forms.field}>
              <span className={forms.label}>Jumlah jam</span>
              <input className={forms.input} type="number" min={1} max={14} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </label>
            <Button type="button" variant="secondary" onClick={fillWeekdays}>
              Isi
            </Button>
          </div>
          <p className={forms.hint}>Lalu sesuaikan jam istirahat dan hari Jumat di bawah.</p>
        </div>
      )}

      {WEEK.map((day) => {
        const rows = days[day] ?? [];
        const set = (i: number, patch: Partial<Period>) => edit(day, rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
        const last = rows[rows.length - 1];
        return (
          <fieldset key={day} className={page.day} disabled={!canEdit}>
            <legend className={forms.label}>{DAY_NAMES[day]}</legend>
            {rows.length === 0 && <p className={forms.hint}>Tidak ada pelajaran.</p>}
            {rows.map((r, i) => (
              <div key={i} className={page.periodRow}>
                <span>Jam {r.number}</span>
                <input className={forms.input} type="time" aria-label={`${DAY_NAMES[day]} jam ${r.number} mulai`} value={r.startsAt} onChange={(e) => set(i, { startsAt: e.target.value })} />
                <input className={forms.input} type="time" aria-label={`${DAY_NAMES[day]} jam ${r.number} selesai`} value={r.endsAt} onChange={(e) => set(i, { endsAt: e.target.value })} />
                <Button type="button" variant="secondary" aria-label={`Hapus jam ${r.number}`} onClick={() => edit(day, rows.filter((_, j) => j !== i))}>
                  ×
                </Button>
              </div>
            ))}
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const startsAt = last ? last.endsAt : start;
                  edit(day, [...rows, { number: (last?.number ?? 0) + 1, startsAt, endsAt: toTime(toMinutes(startsAt) + minutes) }]);
                }}
              >
                + Tambah jam
              </Button>
            )}
          </fieldset>
        );
      })}

      {message && (
        <p className={message.ok ? styles.notice : forms.error} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}
      {canEdit && (
        <div className={page.actions}>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            Simpan jam pelajaran
          </Button>
        </div>
      )}
    </section>
  );
}
