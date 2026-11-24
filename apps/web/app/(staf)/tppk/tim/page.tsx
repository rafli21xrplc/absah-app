'use client';

import { SchoolMembersResponse, TppkMemberList } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { reportUrl, staffCandidates } from '@/lib/tppk';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';

/**
 * Tim TPPK (admin): who is on the team, at least 3 (warned, not enforced), and the QR poster for the
 * report form. Being admin gives no access to reports; every change is told to the whole team.
 */
export default function TimTppkPage() {
  const { schoolId, isAdmin, me } = useWorkspace();
  const school = me.schools.find((s) => s.id === schoolId);
  const [team, setTeam] = useState<TppkMemberList | null>(null);
  const [staff, setStaff] = useState<{ userId: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Built in the browser only (the origin), after mount, so server and client render alike.
  const [poster, setPoster] = useState<{ link: string; qr: string } | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/tppk/members', TppkMemberList, { schoolId })
      .then(setTeam)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat tim TPPK.'));
    if (isAdmin) {
      api('/school/members', SchoolMembersResponse, { schoolId })
        .then((m) => setStaff(staffCandidates(m.items)))
        .catch(() => undefined);
    }
  }, [schoolId, isAdmin]);

  useEffect(() => {
    if (!schoolId) return;
    const link = reportUrl(window.location.origin, schoolId);
    void QRCode.toDataURL(link, { margin: 1, width: 480 }).then((qr) => setPoster({ link, qr }));
  }, [schoolId]);

  const selected = chosen ?? new Set(team?.items.map((m) => m.userId) ?? []);
  const toggle = (userId: string) => {
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setChosen(next);
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await api('/tppk/members', TppkMemberList, { method: 'PUT', schoolId, idempotencyKey: newIdempotencyKey(), body: { userIds: [...selected] } });
      setTeam(saved);
      setChosen(null);
      setNotice('Tim TPPK tersimpan. Semua anggota diberi tahu perubahannya.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <IfCap name="student.tppk" fallback={<p className={styles.main}>Kanal TPPK belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Tim TPPK</h1>
        <p className={styles.muted}>Laporan dan kasus hanya bisa dibuka oleh anggota tim, termasuk bagi admin dan kepala sekolah.</p>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {team?.belowMinimum && (
          <p className={styles.notice} role="note">
            Tim TPPK sebaiknya minimal {team.minimum} orang. Saat ini {team.items.length}.
          </p>
        )}

        <section className={styles.section} aria-labelledby="anggota">
          <h2 id="anggota">Anggota</h2>
          {team?.items.length === 0 && <p className={styles.muted}>Belum ada anggota.</p>}
          <ul>
            {team?.items.map((m) => (
              <li key={m.userId}>
                {m.name}
                {!m.canBeNotified && <span className={styles.badgeWarn}> belum punya nomor WhatsApp</span>}
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && (
          <section className={styles.section} aria-labelledby="ubah">
            <h2 id="ubah">Ubah anggota</h2>
            <fieldset aria-label="Pilih anggota TPPK" style={{ border: 0, padding: 0, display: 'grid', gap: 8 }}>
              {staff.map((s) => (
                <label key={s.userId}>
                  <input type="checkbox" checked={selected.has(s.userId)} onChange={() => toggle(s.userId)} /> {s.name}
                </label>
              ))}
            </fieldset>
            <Button disabled={busy || chosen === null} onClick={() => void save()}>
              {busy ? 'Menyimpan…' : 'Simpan tim'}
            </Button>
          </section>
        )}

        <section className={styles.section} aria-labelledby="poster">
          <h2 id="poster">Poster kanal lapor</h2>
          <p className={styles.muted}>Cetak dan tempel di tempat yang mudah dilihat siswa. Laporan dari QR ini langsung ke tim TPPK.</p>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL
            <img src={poster.qr} alt="QR kanal lapor TPPK" width={240} height={240} />
          )}
          <p>
            <strong>Lapor ke TPPK {school?.name}</strong>
            <br />
            <span data-testid="report-link">{poster?.link}</span>
          </p>
          <Button variant="secondary" onClick={() => window.print()}>
            Cetak poster
          </Button>
        </section>
      </main>
    </IfCap>
  );
}
