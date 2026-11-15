import type { Metadata } from 'next';
import styles from '../../shell.module.css';

export const metadata: Metadata = { title: 'Pembimbing industri' };

export default function DudiHome() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Pembimbing industri</p>
      <h1 className={styles.title}>Konfirmasi kehadiran PKL</h1>
      <p>Daftar siswa PKL di tempat Anda akan tampil di sini.</p>
    </main>
  );
}
