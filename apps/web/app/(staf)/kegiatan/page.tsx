'use client';

import { Activity, ActivityList, SchoolMembersResponse, type ActivityKind, type ActivityLocation } from '@absah/contracts';
import { Button, Select } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ACTIVITY_MANAGERS, DAY_LABELS, DAYS, KIND_LABELS, KINDS, LOCATION_LABELS, LOCATIONS, scheduleLabel } from '@/lib/activities';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { staffCandidates } from '@/lib/tppk';
import { useCapability } from '@/lib/capabilities';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

/** Kegiatan (KEG-01): managers see and create all; a pembina sees the activities they coach. */
export default function KegiatanPage() {
  const { schoolId, hasRole } = useWorkspace();
  const manager = hasRole(...ACTIVITY_MANAGERS);
  const [list, setList] = useState<ActivityList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/activities', ActivityList, { schoolId })
      .then(setList)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat kegiatan.'));
  }, [schoolId]);
  useEffect(load, [load]);

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Kegiatan</h1>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {list && list.items.length === 0 && <p className={styles.empty}>{manager ? 'Belum ada kegiatan.' : 'Belum ada kegiatan yang Anda bina.'}</p>}
      <ul className={ui.sessions} aria-label="Daftar kegiatan">
        {list?.items.map((a) => (
          <li key={a.id}>
            <Link className={ui.sessionCard} href={`/kegiatan/${a.id}`}>
              <span className={ui.sessionTitle}>{a.name}</span>
              <span>
                {KIND_LABELS[a.kind]} · {LOCATION_LABELS[a.location]} · {scheduleLabel(a)}
              </span>
              <span>
                {a.memberCount} peserta · Pembina: {a.coaches.map((c) => c.name).join(', ')}
                {!a.active && ' · Tidak aktif'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {manager && <NewActivity schoolId={schoolId} onDone={load} />}
    </main>
  );
}

function NewActivity({ schoolId, onDone }: { schoolId: string | null; onDone: () => void }) {
  const [staff, setStaff] = useState<{ userId: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ActivityKind>('ekskul');
  // KEG-03: ibadah berjamaah only where religious.worship is on (the API refuses it otherwise).
  const worship = useCapability('religious.worship') === true;
  const [location, setLocation] = useState<ActivityLocation>('sekolah');
  const [days, setDays] = useState<number[]>([]);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [coachIds, setCoachIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const changed = () => {
    key.current = null;
  };

  useEffect(() => {
    if (!schoolId) return;
    api('/school/members', SchoolMembersResponse, { schoolId })
      .then((r) => setStaff(staffCandidates(r.items)))
      .catch(() => setStaff([]));
  }, [schoolId]);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Tulis nama kegiatan.');
    if (coachIds.length === 0) return setError('Pilih minimal satu pembina.');
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), kind, location, days, coachIds, ...(startsOn ? { startsOn } : {}), ...(endsOn ? { endsOn } : {}) };
      await api('/activities', Activity, { method: 'POST', schoolId, idempotencyKey: key.current, body });
      key.current = null;
      setName('');
      setDays([]);
      setStartsOn('');
      setEndsOn('');
      setCoachIds([]);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.section} onSubmit={(e) => void submit(e)} aria-labelledby="baru">
      <h2 id="baru">Kegiatan baru</h2>
      <label className={forms.field}>
        Nama kegiatan
        <input
          value={name}
          maxLength={100}
          onChange={(e) => {
            changed();
            setName(e.target.value);
          }}
        />
      </label>
      <label className={forms.field}>
        Jenis
        <Select
          value={kind}
          onChange={(e) => {
            changed();
            setKind(e.target.value as ActivityKind);
          }}
        >
          {KINDS.filter((k) => k !== 'ibadah' || worship).map((k) => (
            <option key={k} value={k}>
              {k === 'ibadah' ? 'Ibadah berjamaah' : KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </label>
      <fieldset className={forms.field}>
        <legend>Tempat</legend>
        {LOCATIONS.map((l) => (
          <label key={l}>
            <input
              type="radio"
              name="location"
              checked={location === l}
              onChange={() => {
                changed();
                setLocation(l);
              }}
            />{' '}
            {LOCATION_LABELS[l]}
          </label>
        ))}
        <span className={forms.hint}>Peserta kegiatan di luar sekolah tidak dihitung dalam prakiraan porsi MBG.</span>
      </fieldset>
      <fieldset className={forms.field}>
        <legend>Hari (kosongkan untuk kegiatan beberapa hari berturut-turut, isi tanggal mulai dan selesai)</legend>
        {DAYS.map((d) => (
          <label key={d}>
            <input
              type="checkbox"
              checked={days.includes(d)}
              onChange={() => {
                changed();
                setDays((x) => toggle(x, d));
              }}
            />{' '}
            {DAY_LABELS[d]}
          </label>
        ))}
      </fieldset>
      <label className={forms.field}>
        Tanggal mulai (boleh kosong)
        <input
          type="date"
          value={startsOn}
          onChange={(e) => {
            changed();
            setStartsOn(e.target.value);
          }}
        />
      </label>
      <label className={forms.field}>
        Tanggal selesai (boleh kosong)
        <input
          type="date"
          value={endsOn}
          onChange={(e) => {
            changed();
            setEndsOn(e.target.value);
          }}
        />
      </label>
      <fieldset className={forms.field}>
        <legend>Pembina</legend>
        {staff.map((s) => (
          <label key={s.userId}>
            <input
              type="checkbox"
              checked={coachIds.includes(s.userId)}
              onChange={() => {
                changed();
                setCoachIds((x) => toggle(x, s.userId));
              }}
            />{' '}
            {s.name}
          </label>
        ))}
      </fieldset>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan kegiatan'}
      </Button>
    </form>
  );
}
