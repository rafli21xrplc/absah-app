'use client';

import { PointRule, PointRuleList, PointThreshold, PointThresholdList } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { amountOf, isValidAmount, POINT_KIND_LABELS, POINT_MANAGERS, signedForKind, signedPoints } from '@/lib/ksw';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';

/**
 * Aturan poin and ambang (KSW-01, KSW-03). Everyone who records points reads them; admin and wakasek write.
 * A rule or tier is switched off, never deleted, because entries and tasks cite it.
 */
export default function AturanPage() {
  const { schoolId, hasRole } = useWorkspace();
  const manage = hasRole(...POINT_MANAGERS);
  return (
    <IfCap name="student.points" fallback={<p className={styles.main}>Poin kesiswaan belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/poin">
          ← Poin kesiswaan
        </Link>
        <h1 className={styles.title}>Aturan poin dan ambang</h1>
        <Rules schoolId={schoolId} manage={manage} />
        <Thresholds schoolId={schoolId} manage={manage} />
      </main>
    </IfCap>
  );
}

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');

function Rules({ schoolId, manage }: { schoolId: string | null; manage: boolean }) {
  const [rules, setRules] = useState<PointRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<PointRule['kind']>('violation');
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('5');
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/point-rules?all=${manage}`, PointRuleList, { schoolId })
      .then((r) => setRules(r.items))
      .catch(() => setError('Tidak bisa memuat aturan.'));
  }, [schoolId, manage]);
  useEffect(load, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (category.trim().length < 2 || name.trim().length < 2) return setError('Tulis kategori dan nama aturan.');
    if (!isValidAmount(n)) return setError('Poin harus bilangan bulat 1 sampai 100.');
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      await api('/point-rules', PointRule, { method: 'POST', schoolId, idempotencyKey: key.current, body: { kind, category, name, points: signedForKind(kind, n) } });
      key.current = null;
      setName('');
      load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function update(rule: PointRule, fields: { active?: boolean; points?: number }) {
    setError(null);
    try {
      await api(`/point-rules/${rule.id}`, PointRule, { method: 'PUT', schoolId, idempotencyKey: newIdempotencyKey(), body: fields });
      load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <section className={styles.section} aria-labelledby="aturan">
      <h2 id="aturan">Aturan poin</h2>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {rules.length === 0 && <p className={styles.empty}>Belum ada aturan poin.</p>}
      <ul className={ui.sessions}>
        {rules.map((r) => (
          <li key={r.id} className={ui.student} aria-label={r.name}>
            <span className={ui.studentName}>
              {r.name} ({signedPoints(r.points)})
            </span>
            <span>
              {POINT_KIND_LABELS[r.kind]} · {r.category}
            </span>
            {!r.active && <span className={styles.badgeWarn}>Nonaktif</span>}
            {manage && (
              <span>
                <Button variant="secondary" type="button" onClick={() => void update(r, { active: !r.active })}>
                  {r.active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>{' '}
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    const next = window.prompt(`Poin baru untuk ${r.name} (1 sampai 100)`, String(amountOf(r.points)));
                    if (next === null) return;
                    const n = Number(next);
                    if (!isValidAmount(n)) return setError('Poin harus bilangan bulat 1 sampai 100.');
                    void update(r, { points: signedForKind(r.kind, n) });
                  }}
                >
                  Ubah poin
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {manage && (
        <form onSubmit={(e) => void create(e)} aria-label="Aturan baru">
          <h3>Aturan baru</h3>
          <fieldset className={forms.field}>
            <legend>Jenis</legend>
            {(['violation', 'achievement'] as const).map((k) => (
              <label key={k}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} /> {POINT_KIND_LABELS[k]}
              </label>
            ))}
          </fieldset>
          <label className={forms.field}>
            Kategori
            <input value={category} maxLength={40} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className={forms.field}>
            Nama aturan
            <input value={name} maxLength={100} onChange={(e) => { key.current = null; setName(e.target.value); }} />
          </label>
          <label className={forms.field}>
            Jumlah poin ({kind === 'violation' ? 'dikurangkan' : 'ditambahkan'})
            <input type="number" min={1} max={100} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Tambah aturan'}
          </Button>
        </form>
      )}
    </section>
  );
}

function Thresholds({ schoolId, manage }: { schoolId: string | null; manage: boolean }) {
  const [tiers, setTiers] = useState<PointThreshold[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [minPoints, setMinPoints] = useState('25');
  const [label, setLabel] = useState('');
  const [action, setAction] = useState('');
  const [notifyParents, setNotifyParents] = useState(true);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/point-thresholds?all=${manage}`, PointThresholdList, { schoolId })
      .then((r) => setTiers(r.items))
      .catch(() => setError('Tidak bisa memuat ambang.'));
  }, [schoolId, manage]);
  useEffect(load, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const n = Number(minPoints);
    if (!Number.isInteger(n) || n < 1 || n > 1000) return setError('Ambang harus bilangan bulat 1 sampai 1000.');
    if (label.trim().length < 2 || action.trim().length < 2) return setError('Tulis nama tingkat dan tindak lanjutnya.');
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      await api('/point-thresholds', PointThreshold, { method: 'POST', schoolId, idempotencyKey: key.current, body: { minPoints: n, label, action, notifyParents } });
      key.current = null;
      setLabel('');
      setAction('');
      load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(tier: PointThreshold) {
    setError(null);
    try {
      await api(`/point-thresholds/${tier.id}`, PointThreshold, { method: 'PUT', schoolId, idempotencyKey: newIdempotencyKey(), body: { active: !tier.active } });
      load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <section className={styles.section} aria-labelledby="ambang">
      <h2 id="ambang">Ambang poin pelanggaran</h2>
      <p>Saat total poin pelanggaran seorang siswa di tahun ajaran ini melewati ambang, siswa itu mendapat satu tugas tindak lanjut.</p>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {tiers.length === 0 && <p className={styles.empty}>Belum ada ambang.</p>}
      <ul className={ui.sessions}>
        {tiers.map((t) => (
          <li key={t.id} className={ui.student} aria-label={t.label}>
            <span className={ui.studentName}>
              {t.minPoints} poin · {t.label}
            </span>
            <span>
              {t.action}
              {t.notifyParents ? ' · orang tua diberi tahu' : ''}
            </span>
            {!t.active && <span className={styles.badgeWarn}>Nonaktif</span>}
            {manage && (
              <Button variant="secondary" type="button" onClick={() => void toggle(t)}>
                {t.active ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {manage && (
        <form onSubmit={(e) => void create(e)} aria-label="Ambang baru">
          <h3>Ambang baru</h3>
          <label className={forms.field}>
            Mulai dari (poin)
            <input type="number" min={1} max={1000} value={minPoints} onChange={(e) => { key.current = null; setMinPoints(e.target.value); }} />
          </label>
          <label className={forms.field}>
            Nama tingkat
            <input value={label} maxLength={60} onChange={(e) => { key.current = null; setLabel(e.target.value); }} />
          </label>
          <label className={forms.field}>
            Tindak lanjut
            <input value={action} maxLength={200} onChange={(e) => { key.current = null; setAction(e.target.value); }} />
          </label>
          <label>
            <input type="checkbox" checked={notifyParents} onChange={(e) => { key.current = null; setNotifyParents(e.target.checked); }} /> Beri tahu orang tua lewat WhatsApp
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Tambah ambang'}
          </Button>
        </form>
      )}
    </section>
  );
}
