'use client';

import { LoadingState } from '@absah/ui';
import { ArrivalBoard } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { arrivedPercent, BOARD_POLL_MS, boardIsStale, boardOrder, timeIn, toChase } from '@/lib/gate';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import gate from '../gerbang.module.css';

/** Papan kedatangan (GRB-08): per rombel who is in, late and not in yet, refreshed every 5 s while the tab is visible. */
export default function PapanKedatanganPage() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [board, setBoard] = useState<ArrivalBoard | null>(null);
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    const controller = new AbortController();
    let timer: number | undefined;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        api('/gate/board', ArrivalBoard, { schoolId, signal: controller.signal })
          .then((b) => {
            setBoard(b);
            setLastOkAt(Date.now());
            setError(null);
          })
          .catch((err: unknown) => {
            if (controller.signal.aborted) return;
            // A failed poll keeps the last board on screen; the stale notice appears by itself.
            if (err instanceof ApiError && err.status !== 429 && err.status < 500) setError(err.message);
          })
          .finally(() => setNow(Date.now()));
      }
      timer = window.setTimeout(tick, BOARD_POLL_MS);
    };
    tick();
    const wake = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', wake);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [schoolId]);

  const stale = board !== null && boardIsStale(lastOkAt, now);

  return (
    <IfCap name="gate.enabled" fallback={<p className={styles.main}>Presensi gerbang belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/gerbang">
          ← Gerbang
        </Link>
        <h1 className={styles.title}>Papan kedatangan</h1>
        {error && <p role="alert">{error}</p>}
        {!board && !error && <LoadingState variant="cards" />}
        {board && (
          <>
            <div className={styles.counts} aria-label="Ringkasan sekolah">
              <p className={styles.count}>
                <strong>{board.totals.onTime + board.totals.late}</strong> sudah datang
              </p>
              <p className={styles.count}>
                <strong>{board.totals.late}</strong> terlambat
              </p>
              <p className={styles.count}>
                <strong>{board.totals.notArrived}</strong> belum datang
              </p>
            </div>
            <p className={styles.muted}>
              Diperbarui {timeIn(timezone, board.updatedAt)} · terlambat bila datang setelah pukul {board.lateAfter.replace(':', '.')}
              {board.totals.excused > 0 ? ` · ${board.totals.excused} belum datang karena izin/sakit` : ''}
            </p>
            {stale && <p role="status" className={styles.notice}>Koneksi terputus. Angka di bawah mungkin sudah berubah.</p>}
            <table className={gate.board} aria-label="Kedatangan per rombel">
              <thead>
                <tr>
                  <th scope="col">Rombel</th>
                  <th scope="col">Tepat waktu</th>
                  <th scope="col">Terlambat</th>
                  <th scope="col">Belum datang</th>
                  <th scope="col">Hadir</th>
                </tr>
              </thead>
              <tbody>
                {boardOrder(board.classes).map((c) => (
                  <tr key={c.className}>
                    <th scope="row">{c.className}</th>
                    <td>{c.onTime}</td>
                    <td>{c.late}</td>
                    <td data-chase={toChase(c) > 0}>
                      {c.notArrived}
                      {c.excused > 0 ? <span className={styles.muted}> ({c.excused} izin)</span> : null}
                    </td>
                    <td>{arrivedPercent(c)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </main>
    </IfCap>
  );
}
