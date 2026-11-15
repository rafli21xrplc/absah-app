import { LEVEL_LABELS } from '@/lib/levels';
import styles from '../shell.module.css';

export default function StafHome() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Staf sekolah</p>
      <h1 className={styles.title}>Hari ini</h1>
      <p>Absah sedang disiapkan. Masuk dan layar presensi hadir di fase berikutnya.</p>
      <div className={styles.card}>
        <strong>Jenjang yang didukung</strong>
        <p>{Object.values(LEVEL_LABELS).join(' · ')}</p>
      </div>
    </main>
  );
}
