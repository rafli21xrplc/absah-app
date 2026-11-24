'use client';

import { CandidateList, SubstitutionItem, SubstitutionList, type SubstituteCandidate } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { todayIn } from '@/lib/leave';
import { candidateNotes, sessionTimeLabel, SUBSTITUTION_ASSIGNING, SUBSTITUTION_READING, TEACHER_LEAVE_KIND_LABELS } from '@/lib/teacher';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

/** Guru pengganti (GRU-03): sessions whose teacher is on izin stay here until someone is assigned. */
export default function PenggantiPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [date, setDate] = useState(() => todayIn(timezone));
  const [items, setItems] = useState<SubstitutionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const assigns = hasRole(...SUBSTITUTION_ASSIGNING);

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/substitutions?date=${date}`, SubstitutionList, { schoolId })
      .then((r) => {
        setItems(r.items);
        setError(null);
      })
      .catch(() => setError('Tidak bisa memuat daftar pengganti.'));
  }, [schoolId, date]);
  useEffect(load, [load]);

  const needed = items?.filter((i) => i.status === 'needed') ?? [];

  return (
    <IfCap name="teacher.attendance" fallback={<p className={styles.main}>Guru pengganti belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Guru pengganti</h1>
        {!hasRole(...SUBSTITUTION_READING) ? (
          <p className={styles.empty}>Peran Anda tidak membuka daftar guru pengganti.</p>
        ) : (
          <>
            <label className={forms.field}>
              Tanggal
              <input type="date" value={date} onChange={(e) => { setPicking(null); setDate(e.target.value); }} />
            </label>
            <p className={styles.muted}>Daftar memuat sesi yang sudah dibuat sistem untuk hari itu. Hari yang belum berjalan masih kosong.</p>
            {error && (
              <p className={forms.error} role="alert">
                {error}
              </p>
            )}
            {items && needed.length > 0 && (
              <p role="status" className={styles.badgeWarn}>
                {needed.length} sesi belum punya pengganti
              </p>
            )}
            {items?.length === 0 && <p className={styles.empty}>Tidak ada sesi yang gurunya sedang izin.</p>}
            <ul className={ui.sessions}>
              {items?.map((i) => (
                <li key={i.session.id} className={ui.student} aria-label={`${i.session.owner.name} ${sessionTimeLabel(i.session.period)}`}>
                  <span className={ui.studentName}>
                    {sessionTimeLabel(i.session.period)} · {i.session.owner.name}
                    {i.session.subject ? ` · ${i.session.subject.name}` : ''}
                  </span>
                  <span>
                    {i.absentTeacher.name}
                    {i.leaveKind ? ` (${TEACHER_LEAVE_KIND_LABELS[i.leaveKind]})` : ''}
                  </span>
                  {i.status === 'needed' ? <span className={styles.badgeWarn}>Belum ada pengganti</span> : <span className={styles.badgeOk}>Pengganti: {i.substitute?.name}</span>}
                  {assigns &&
                    (picking === i.session.id ? (
                      <Candidates
                        schoolId={schoolId}
                        item={i}
                        onClose={() => setPicking(null)}
                        onDone={() => {
                          setPicking(null);
                          load();
                        }}
                      />
                    ) : (
                      <Button variant={i.status === 'needed' ? 'primary' : 'secondary'} type="button" onClick={() => setPicking(i.session.id)}>
                        {i.status === 'needed' ? 'Pilih pengganti' : 'Ganti pengganti'}
                      </Button>
                    ))}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </IfCap>
  );
}

function Candidates({ schoolId, item, onClose, onDone }: { schoolId: string | null; item: SubstitutionItem; onClose: () => void; onDone: () => void }) {
  const [list, setList] = useState<SubstituteCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/substitutions/candidates?sessionId=${item.session.id}`, CandidateList, { schoolId })
      .then((r) => setList(r.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat guru yang kosong.'));
  }, [schoolId, item.session.id]);

  async function assign(c: SubstituteCandidate) {
    setBusy(true);
    setError(null);
    try {
      await api('/substitutions', SubstitutionItem, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { sessionId: item.session.id, substituteId: c.userId } });
      onDone();
    } catch (err) {
      // The list may be stale (someone else just assigned this teacher): say why and show it again.
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu coba lagi.');
      setBusy(false);
      api(`/substitutions/candidates?sessionId=${item.session.id}`, CandidateList, { schoolId })
        .then((r) => setList(r.items))
        .catch(() => undefined);
    }
  }

  return (
    <div role="group" aria-label="Guru yang kosong">
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {!list && !error && <p role="status">Memuat…</p>}
      {list?.length === 0 && <p className={styles.empty}>Tidak ada guru yang kosong pada jam ini.</p>}
      <ul className={ui.sessions}>
        {list?.map((c) => (
          <li key={c.userId} className={ui.student}>
            <span className={ui.studentName}>{c.name}</span>
            <span className={styles.muted}>{candidateNotes(c)}</span>
            <Button type="button" disabled={busy} onClick={() => void assign(c)}>
              Tugaskan {c.name}
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" type="button" onClick={onClose}>
        Tutup
      </Button>
    </div>
  );
}
