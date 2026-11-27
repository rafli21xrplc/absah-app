'use client';

import { DudiPartnerList, PklPlacementList, PklStaffList, PklStudentList, type DudiPartner } from '@absah/contracts';
import { Button, DateInput, Input, Select } from '@absah/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { normalizePhone } from '@/lib/auth';
import { IfCap } from '@/lib/capabilities';
import { todayIn } from '@/lib/leave';
import { PKL_MANAGERS } from '@/lib/pkl';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';

type Student = PklStudentList['items'][number];

/** Place a batch of students at one DUDI with one period and supervisors (PKL-01). */
export default function NewPlacementsPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const router = useRouter();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [partners, setPartners] = useState<DudiPartner[]>([]);
  const [mentors, setMentors] = useState<PklStaffList['items']>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Student[]>([]);
  const [picked, setPicked] = useState<Student[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const key = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    void api('/pkl/partners', DudiPartnerList, { schoolId }).then((r) => setPartners(r.items.filter((p) => p.active)));
    void api('/pkl/school-mentors', PklStaffList, { schoolId }).then((r) => setMentors(r.items));
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(`/pkl/students?q=${encodeURIComponent(query.trim())}`, PklStudentList, { schoolId, signal: controller.signal })
        .then((r) => setFound(r.items))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [schoolId, query]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const mentorName = String(d.get('mentorName') ?? '').trim();
    const mentorPhone = String(d.get('mentorPhone') ?? '').trim();
    const body = {
      enrollmentIds: picked.map((s) => s.enrollmentId),
      partnerId: String(d.get('partnerId')),
      startsOn: String(d.get('startsOn')),
      endsOn: String(d.get('endsOn')),
      schoolMentorId: String(d.get('schoolMentorId')),
      industryMentor: mentorPhone ? { name: mentorName, phoneNumber: normalizePhone(mentorPhone) } : null,
    };
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setErr(null);
    try {
      await api('/pkl/placements', PklPlacementList, { method: 'POST', schoolId, idempotencyKey: key.current, body });
      router.push('/pkl');
    } catch (error) {
      setErr(error);
    } finally {
      setBusy(false);
    }
  }

  const overlap = err instanceof ApiError && err.body.details && typeof err.body.details === 'object' && 'enrollmentIds' in err.body.details ? (err.body.details as { enrollmentIds: string[] }).enrollmentIds : [];
  const message =
    err instanceof ApiError
      ? overlap.length > 0
        ? `${err.message} ${picked.filter((s) => overlap.includes(s.enrollmentId)).map((s) => s.name).join(', ')}`
        : (fieldError(err, 'industryMentor.phoneNumber') ?? fieldError(err, 'endsOn') ?? err.message)
      : err
        ? 'Belum tersimpan. Periksa sinyal, lalu coba lagi.'
        : null;
  const today = todayIn(timezone);
  return (
    <IfCap name="pkl.enabled" fallback={<p className={styles.main}>PKL belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/pkl">
          ← PKL
        </Link>
        <h1 className={styles.title}>Tempatkan siswa PKL</h1>
        {!hasRole(...PKL_MANAGERS) && <p>Halaman ini untuk humas PKL, wakasek, dan admin.</p>}
        {hasRole(...PKL_MANAGERS) && (
          <form className={styles.section} onSubmit={(e) => void submit(e)} onChange={() => (key.current = null)}>
            <label className={forms.field}>
              <span className={forms.label}>DUDI</span>
              <Select name="partnerId" required defaultValue="">
                <option value="" disabled>
                  Pilih DUDI
                </option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              {partners.length === 0 && (
                <span className={forms.hint}>
                  Belum ada DUDI aktif. <Link href="/pkl/dudi">Tambah DUDI</Link> dulu.
                </span>
              )}
            </label>
            <label className={forms.field}>
              <span className={forms.label}>Cari siswa</span>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nama atau NISN, minimal 2 huruf" autoComplete="off" />
            </label>
            {query.trim().length >= 2 && (
              <ul className={ui.sessions} aria-label="Hasil pencarian">
                {found
                  .filter((s) => !picked.some((p) => p.enrollmentId === s.enrollmentId))
                  .map((s) => (
                    <li key={s.enrollmentId}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          key.current = null;
                          setPicked((ps) => [...ps, s]);
                        }}
                      >
                        + {s.name} · {s.className}
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
            <p>
              <strong>{picked.length} siswa dipilih</strong>
            </p>
            <ul aria-label="Siswa dipilih">
              {picked.map((s) => (
                <li key={s.enrollmentId}>
                  {s.name} · {s.className}{' '}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      key.current = null;
                      setPicked((ps) => ps.filter((p) => p.enrollmentId !== s.enrollmentId));
                    }}
                  >
                    Hapus
                  </Button>
                </li>
              ))}
            </ul>
            <label className={forms.field}>
              <span className={forms.label}>Mulai</span>
              <DateInput name="startsOn" type="date" defaultValue={today} required />
            </label>
            <label className={forms.field}>
              <span className={forms.label}>Selesai</span>
              <DateInput name="endsOn" type="date" min={today} required />
            </label>
            <label className={forms.field}>
              <span className={forms.label}>Guru pembimbing</span>
              <Select name="schoolMentorId" required defaultValue="">
                <option value="" disabled>
                  Pilih guru
                </option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className={forms.field}>
              <span className={forms.label}>Nama pembimbing industri (boleh nanti)</span>
              <Input name="mentorName" maxLength={100} />
            </label>
            <label className={forms.field}>
              <span className={forms.label}>Nomor WhatsApp pembimbing industri</span>
              <Input name="mentorPhone" type="tel" inputMode="tel" placeholder="0812…" />
              <span className={forms.hint}>Pembimbing industri masuk ke /dudi dengan kode WhatsApp ke nomor ini.</span>
            </label>
            {message && (
              <p className={forms.error} role="alert">
                {message}
              </p>
            )}
            <Button type="submit" disabled={busy || picked.length === 0}>
              {busy ? 'Menyimpan…' : `Tempatkan ${picked.length} siswa`}
            </Button>
          </form>
        )}
      </main>
    </IfCap>
  );
}
