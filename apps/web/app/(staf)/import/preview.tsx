'use client';

import type { ImportPreviewItem, StudentImportResponse } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import styles from '../data.module.css';

const FIELD_LABELS: Record<string, string> = {
  name: 'Nama',
  nisn: 'NISN',
  nik: 'NIK',
  localId: 'NIPD',
  gender: 'JK',
  birthPlace: 'Tempat lahir',
  birthDate: 'Tanggal lahir',
  className: 'Rombel',
};
const MATCH_LABELS: Record<string, string> = { nisn: 'NISN', nik: 'NIK', name_birthdate: 'nama + tanggal lahir' };

function Section({ title, items, render }: { title: string; items: ImportPreviewItem[]; render: (i: ImportPreviewItem) => React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.section} aria-label={title}>
      <h2>
        {title} ({items.length})
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Baris</th>
              <th>Nama</th>
              <th>NISN</th>
              <th>Rombel</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={`${i.kind}-${i.row ?? i.name}-${i.nisn ?? ''}`}>
                <td className={styles.muted}>{i.row ?? '–'}</td>
                <td>{i.name}</td>
                <td className={i.nisn ? undefined : styles.muted}>{i.nisn ?? 'belum ada'}</td>
                <td className={i.className ? undefined : styles.muted}>{i.className ?? '–'}</td>
                <td>{render(i)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Preview of an import: counts, then each kind of change in its own table. */
export function ImportPreview({
  imp,
  committing,
  onCommit,
  onCancel,
}: {
  imp: StudentImportResponse;
  committing: boolean;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const counts = imp.counts;
  const of = (kind: ImportPreviewItem['kind']) => imp.items.filter((i) => i.kind === kind);
  const applies = (counts?.created ?? 0) + (counts?.changed ?? 0) + (counts?.missing ?? 0);
  const committed = imp.status === 'committed';

  return (
    <div>
      {committed ? (
        <p className={styles.notice} role="status">
          Import diterapkan ke tahun ajaran {imp.academicYear}. <Link href="/siswa">Lihat data siswa</Link>
          {(counts?.missing ?? 0) > 0 && (
            <>
              {' '}
              · <Link href="/siswa?status=missing">Tindak lanjuti {counts?.missing} calon keluar</Link>
            </>
          )}
        </p>
      ) : (
        <p>
          Pratinjau <strong>{imp.fileName}</strong> untuk tahun ajaran <strong>{imp.academicYear}</strong>. Belum ada data yang berubah.
        </p>
      )}
      {counts && (
        <div className={styles.counts} data-testid="import-counts">
          {(
            [
              ['created', 'Siswa baru'],
              ['changed', 'Berubah'],
              ['unchanged', 'Tetap'],
              ['missing', 'Calon keluar'],
              ['rejected', 'Ditolak'],
              ['warnings', 'Peringatan'],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className={styles.count}>
              <strong>{counts[k]}</strong>
              {label}
            </div>
          ))}
        </div>
      )}

      <Section title="Siswa baru" items={of('created')} render={() => <span className={styles.badgeOk}>Baru</span>} />
      <Section
        title="Berubah"
        items={of('changed')}
        render={(i) => (
          <>
            {i.changes.map((c) => (
              <span key={c.field} className={styles.change}>
                {FIELD_LABELS[c.field] ?? c.field}: {c.from ?? '–'} → <strong>{c.to ?? '–'}</strong>
              </span>
            ))}
            {i.matchedBy && <span className={`${styles.change} ${styles.muted}`}>cocok lewat {MATCH_LABELS[i.matchedBy]}</span>}
          </>
        )}
      />
      <Section title="Calon keluar" items={of('missing')} render={(i) => <span className={styles.muted}>{i.message}</span>} />
      <Section title="Ditolak" items={of('rejected')} render={(i) => <span className={styles.badgeBad}>{i.message}</span>} />

      {imp.issues.length > 0 && (
        <section className={styles.section} aria-label="Peringatan">
          <h2>Peringatan ({imp.issues.length})</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>Pesan</th>
                </tr>
              </thead>
              <tbody>
                {imp.issues.map((i) => (
                  <tr key={`${i.row}-${i.field ?? ''}-${i.message}`}>
                    <td className={styles.muted}>{i.row}</td>
                    <td>{i.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!committed && (
        <div className={styles.toolbar} style={{ marginTop: 24 }}>
          <div>
            <Button disabled={committing || applies === 0} onClick={onCommit}>
              {applies === 0 ? 'Tidak ada perubahan' : `Terapkan ${applies} perubahan`}
            </Button>
          </div>
          <div>
            <Button variant="secondary" disabled={committing} onClick={onCancel}>
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
