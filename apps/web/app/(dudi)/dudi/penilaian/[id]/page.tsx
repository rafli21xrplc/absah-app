'use client';

import { PklAssessmentForm } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { assessmentNote, overallText, scoresRequest } from '@/lib/pkl-assessment';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../../forms.module.css';
import styles from '../../../../(portal)/portal.module.css';

/** The DUDI assessment form (PKL-04): one score 0-100 per aspect and a note, by the supervisor of the placement. */
export default function DudiAssessmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const { schoolId, hasRole } = useWorkspace();
  const allowed = hasRole('pembimbing_industri');
  const [form, setForm] = useState<PklAssessmentForm | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const key = useRef<string | null>(null);

  const apply = (f: PklAssessmentForm) => {
    setForm(f);
    setTyped(Object.fromEntries((f.assessment?.scores ?? []).map((s) => [s.aspectId, String(s.score)])));
    setNote(f.assessment?.note ?? '');
  };

  useEffect(() => {
    if (!schoolId || !allowed) return;
    api(`/pkl/placements/${id}/assessment`, PklAssessmentForm, { schoolId })
      .then(apply)
      .catch((err: unknown) => setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Tidak bisa memuat. Periksa internet.' }));
  }, [schoolId, allowed, id]);

  async function save() {
    if (!form) return;
    const request = scoresRequest(form.aspects, typed, note);
    if ('error' in request) {
      setMessage({ ok: false, text: request.error });
      return;
    }
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    try {
      apply(await api(`/pkl/placements/${id}/assessment`, PklAssessmentForm, { method: 'PUT', schoolId, idempotencyKey: key.current, body: request.body }));
      key.current = null;
      setMessage({ ok: true, text: 'Penilaian tersimpan.' });
    } catch (err) {
      if (err instanceof ApiError) key.current = null; // an answer ends the action; a lost reply keeps the key
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  const open = form?.window === 'open';
  return (
    <main className={styles.main}>
      <Link href="/dudi/penilaian">← Penilaian siswa</Link>
      <h1 className={styles.title}>{form ? form.student.name : 'Penilaian'}</h1>
      {!allowed && <p>Halaman ini untuk pembimbing industri PKL.</p>}
      {form && (
        <>
          <p className={styles.muted}>
            {form.student.className} · {form.partner.name} · {assessmentNote(form)}
            {form.assessment && ` · nilai akhir ${overallText(form.assessment.overall)}`}
          </p>
          {form.aspects.length === 0 && <p>Sekolah belum menyusun aspek penilaian. Hubungi guru pembimbing.</p>}
          {!open && <p role="status">Formulir ini {form.window === 'not_yet' ? 'belum dibuka' : 'sudah ditutup'}.</p>}
          {open && form.aspects.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {form.aspects.map((a) => (
                <label key={a.id} className={forms.field}>
                  <span className={forms.label}>{a.name} (0-100)</span>
                  {a.description && <span className={forms.hint}>{a.description}</span>}
                  <input className={forms.input} inputMode="numeric" value={typed[a.id] ?? ''} onChange={(e) => setTyped((t) => ({ ...t, [a.id]: e.target.value }))} />
                </label>
              ))}
              <label className={forms.field}>
                <span className={forms.label}>Catatan (boleh kosong)</span>
                <textarea className={forms.input} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? 'Menyimpan…' : form.assessment ? 'Simpan perbaikan' : 'Simpan penilaian'}
              </Button>
            </form>
          )}
        </>
      )}
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={message.ok ? styles.muted : undefined}>
          {message.text}
        </p>
      )}
    </main>
  );
}
