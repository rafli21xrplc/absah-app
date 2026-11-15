import type { Metadata } from 'next';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'Portal' };

export default function PortalHome() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Orang tua dan siswa</p>
      <h1 className={styles.title}>Portal</h1>
      <p>Kehadiran anak, izin, dan kartu digital akan tampil di sini.</p>
    </main>
  );
}
