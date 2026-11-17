'use client';

import { TppkChannel, TppkReportReceipt, type TppkReportCategory, type TppkReporterRelation } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError } from '@/lib/api';
import { CATEGORIES, CATEGORY_LABELS, formatCode, RELATION_LABELS, RELATIONS } from '@/lib/tppk';
import forms from '../../forms.module.css';
import styles from './lapor.module.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Channel = { state: 'loading' } | { state: 'closed' } | { state: 'open'; schoolName: string };

/**
 * Lapor ke TPPK (KSW-06): calm and short. Anonymous by default; an anonymous report is sent without
 * cookies, so not even the session travels with it. Nothing is stored in the browser.
 */
function LaporForm() {
  const schoolId = useSearchParams().get('s') ?? '';
  const [channel, setChannel] = useState<Channel>({ state: 'loading' });
  const [category, setCategory] = useState<TppkReportCategory | ''>('');
  const [chronology, setChronology] = useState('');
  const [occurredOn, setOccurredOn] = useState('');
  const [relation, setRelation] = useState<TppkReporterRelation | ''>('');
  const [anonymous, setAnonymous] = useState(true);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!UUID_RE.test(schoolId)) {
      void Promise.resolve().then(() => setChannel({ state: 'closed' }));
      return;
    }
    api(`/tppk/channel/${schoolId}`, TppkChannel, { anonymous: true })
      .then((c) => setChannel({ state: 'open', schoolName: c.schoolName }))
      .catch(() => setChannel({ state: 'closed' }));
  }, [schoolId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!category) return setProblem('Pilih jenis kejadian.');
    if (!relation) return setProblem('Pilih siapa Anda.');
    if (chronology.trim().length < 20) return setProblem('Ceritakan apa yang terjadi, minimal 20 huruf.');
    setProblem(null);
    setBusy(true);
    setError(null);
    try {
      const body = {
        schoolId,
        category,
        chronology,
        reporterRelation: relation,
        anonymous,
        ...(occurredOn ? { occurredOn } : {}),
        ...(!anonymous && name.trim() ? { reporterName: name } : {}),
        ...(!anonymous && contact.trim() ? { reporterContact: contact } : {}),
      };
      const receipt = await api('/tppk/reports', TppkReportReceipt, { method: 'POST', body, anonymous });
      setCode(receipt.trackingCode);
      // The story leaves the page as soon as it is sent.
      setChronology('');
      setName('');
      setContact('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (channel.state === 'loading') return <p className={styles.lead}>Memuat…</p>;
  if (channel.state === 'closed') {
    return (
      <>
        <h1 className={styles.title}>Kanal lapor tidak tersedia</h1>
        <p className={styles.lead}>Pindai ulang QR di poster sekolah, atau sampaikan langsung kepada guru yang Anda percaya.</p>
      </>
    );
  }

  if (code) {
    return (
      <>
        <h1 className={styles.title}>Laporan Anda sudah diterima</h1>
        <p className={styles.lead}>Terima kasih sudah berani melapor. Tim TPPK {channel.schoolName} akan membacanya.</p>
        <p className={styles.lead}>Simpan kode lacak ini untuk melihat perkembangan laporan. Kode ini hanya ditampilkan sekali.</p>
        <p className={styles.big} data-testid="tracking-code">
          {formatCode(code)}
        </p>
        <div className={styles.row}>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(formatCode(code)).then(() => setCopied(true));
            }}
          >
            {copied ? 'Kode disalin' : 'Salin kode'}
          </Button>
          <Link href="/lapor/lacak">Lacak laporan</Link>
        </div>
      </>
    );
  }

  const apiProblem = error instanceof ApiError && error.status === 429 ? 'Terlalu banyak laporan dari perangkat ini. Coba lagi dalam satu jam.' : error instanceof ApiError ? error.message : error ? 'Laporan belum terkirim. Periksa internet, lalu kirim lagi.' : null;

  return (
    <>
      <div>
        <h1 className={styles.title}>Lapor ke TPPK</h1>
        <p className={styles.lead}>{channel.schoolName}</p>
      </div>
      <p className={styles.lead}>
        Laporan hanya dibaca oleh Tim Pencegahan dan Penanganan Kekerasan (TPPK) sekolah. Kepala sekolah dan wali kelas tidak menerimanya otomatis. Anda boleh melapor
        tanpa nama.
      </p>
      <p className={styles.safety}>Jika Anda dalam bahaya sekarang, segera cari orang dewasa yang Anda percaya, atau telepon 112. Layanan SAPA 129 juga bisa dihubungi.</p>

      <form className={forms.form} onSubmit={(e) => void submit(e)}>
        <fieldset className={styles.choices}>
          <legend className={forms.label}>Apa yang terjadi?</legend>
          {CATEGORIES.map((c) => (
            <label key={c} className={styles.choice}>
              <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} />
              <span>{CATEGORY_LABELS[c].label}</span>
              <span className={styles.choiceHint}>{CATEGORY_LABELS[c].hint}</span>
            </label>
          ))}
        </fieldset>

        <label className={forms.field}>
          <span className={forms.label}>Ceritakan kejadiannya</span>
          <span className={forms.hint}>Siapa, di mana, kapan, dan apa yang terjadi. Tulis sebisanya.</span>
          <textarea className={styles.textarea} value={chronology} onChange={(e) => setChronology(e.target.value)} maxLength={5000} />
          {fieldError(error, 'chronology') && <span className={forms.error}>{fieldError(error, 'chronology')}</span>}
        </label>

        <label className={forms.field}>
          <span className={forms.label}>Tanggal kejadian (boleh dikosongkan)</span>
          <input className={forms.input} type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
        </label>

        <label className={forms.field}>
          <span className={forms.label}>Saya adalah</span>
          <select className={forms.input} value={relation} onChange={(e) => setRelation(e.target.value as TppkReporterRelation)}>
            <option value="">Pilih</option>
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {RELATION_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.check}>
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          <span>
            Kirim tanpa nama
            <span className={forms.hint}> Nama, akun, dan alamat internet Anda tidak disimpan.</span>
          </span>
        </label>

        {!anonymous && (
          <>
            <label className={forms.field}>
              <span className={forms.label}>Nama (boleh dikosongkan)</span>
              <input className={forms.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="off" />
            </label>
            <label className={forms.field}>
              <span className={forms.label}>Nomor HP atau email untuk dihubungi (boleh dikosongkan)</span>
              <input className={forms.input} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={100} autoComplete="off" />
            </label>
          </>
        )}

        {(problem ?? apiProblem) && (
          <p className={forms.error} role="alert">
            {problem ?? apiProblem}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Mengirim…' : 'Kirim laporan'}
        </Button>
      </form>
      <p className={styles.lead}>
        Sudah pernah melapor? <Link href="/lapor/lacak">Lacak laporan dengan kode</Link>.
      </p>
    </>
  );
}

export default function LaporPage() {
  return (
    <main className={styles.page}>
      <Suspense fallback={<p>Memuat…</p>}>
        <LaporForm />
      </Suspense>
    </main>
  );
}
