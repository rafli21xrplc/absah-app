'use client';

import { MbgForecast } from '@absah/contracts';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { forecastLine } from '@/lib/mbg';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import { DateInput } from '@absah/ui';

/** Prakiraan H-3 (RKP-09): what the PIC got at 13.00 for a coming school day (default three days ahead). */
export function MbgForecastSection({ schoolId, timezone }: { schoolId: string; timezone: string }) {
  const [date, setDate] = useState('');
  const [forecast, setForecast] = useState<MbgForecast | null>(null);

  useEffect(() => {
    api(`/mbg/forecast${date ? `?date=${date}` : ''}`, MbgForecast, { schoolId })
      .then(setForecast)
      .catch(() => setForecast(null));
  }, [schoolId, date]);

  return (
    <section className={styles.section} aria-labelledby="prakiraan">
      <h2 id="prakiraan">Prakiraan porsi (H-3)</h2>
      <label className={forms.field}>
        Tanggal
        <DateInput type="date" value={date || forecast?.date || ''} onChange={(e) => setDate(e.target.value)} />
      </label>
      {forecast && (
        <>
          {forecast.status === 'computed' && (
            <p className={styles.count}>
              <strong>{forecast.total}</strong> porsi
            </p>
          )}
          <p className={styles.muted}>{forecastLine(forecast, timezone)}</p>
          <p className={styles.muted}>Siswa aktif dikurangi izin yang sudah disetujui dan peserta kegiatan di luar sekolah.</p>
          {forecast.classes.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Rombel</th>
                    <th className={styles.num}>Porsi</th>
                    <th className={styles.num}>Siswa</th>
                    <th className={styles.num}>Izin</th>
                    <th className={styles.num}>Di luar sekolah</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.classes.map((c) => (
                    <tr key={c.classId}>
                      <td>{c.name}</td>
                      <td className={styles.num}>{c.forecast}</td>
                      <td className={styles.num}>{c.enrolled}</td>
                      <td className={styles.num}>{c.onLeave || '-'}</td>
                      <td className={styles.num}>{c.offCampus || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
