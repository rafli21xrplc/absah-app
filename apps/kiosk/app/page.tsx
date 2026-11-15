import styles from './page.module.css';

export default function KioskHome() {
  return (
    <main className={styles.screen}>
      <div>
        <h1 className={styles.title}>Kios Absah</h1>
        <p className={styles.hint}>Perangkat belum dipasangkan. Minta kode pasang ke admin sekolah.</p>
      </div>
    </main>
  );
}
