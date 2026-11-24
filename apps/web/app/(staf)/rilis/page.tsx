'use client';

import Link from 'next/link';
import styles from '../data.module.css';
import { useReleases } from '../changelog-context';
import { ReleaseNotes } from '../release-notes';

/** Every release note, newest first, for reading again after the notice on the home page was dismissed. */
export default function RilisPage() {
  const releases = useReleases();
  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Yang baru di Absah</h1>
      {releases.length === 0 && <p className={styles.empty}>Belum ada catatan rilis.</p>}
      {releases.map((release) => (
        <section key={release.id} className={styles.section}>
          <ReleaseNotes release={release} />
        </section>
      ))}
    </main>
  );
}
