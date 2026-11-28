'use client';

import { PklAttachmentLink, PklJournal, PklJournalList } from '@absah/contracts';
import { Button, LoadingState } from '@absah/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { JOURNAL_STATUS_LABELS } from '@/lib/pkl';

const dateLabel = (date: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00Z`));

/**
 * Jurnal PKL (PKL-03), shared by the staff page, /dudi and the student portal. The API decides what
 * each user sees and canReview; `query` adds filters (e.g. "status=submitted"). reload bumps to refetch.
 */
export function PklJournals({ schoolId, query = '', reload = 0, showStudent = true, className }: { schoolId: string; query?: string; reload?: number; showStudent?: boolean; className?: string }) {
  const [items, setItems] = useState<PklJournal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api(`/pkl/journals${query ? `?${query}` : ''}`, PklJournalList, { schoolId })
      .then((r) => setItems(r.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat jurnal.'));
  }, [schoolId, query]);
  useEffect(load, [load, reload]);

  async function openAttachment(j: PklJournal) {
    const tab = window.open('', '_blank');
    try {
      const link = await api(`/pkl/journals/${j.id}/attachment`, PklAttachmentLink, { schoolId });
      if (tab) tab.location.href = link.url;
    } catch (err) {
      tab?.close();
      setError(err instanceof ApiError ? err.message : 'Tidak bisa membuka lampiran.');
    }
  }

  if (!items) return error ? <p role="alert">{error}</p> : <LoadingState label="Memuat jurnal" />;
  return (
    <section className={className} aria-label="Jurnal PKL">
      {error && <p role="alert">{error}</p>}
      {items.length === 0 && <p>Belum ada jurnal.</p>}
      <ul>
        {items.map((j) => (
          <li key={j.id} aria-label={`Jurnal ${j.student.name} ${j.date}`}>
            <p>
              <strong>{dateLabel(j.date)}</strong>
              {showStudent && ` · ${j.student.name} (${j.student.className}) · ${j.partnerName}`} · {JOURNAL_STATUS_LABELS[j.status]}
            </p>
            <p>{j.activity}</p>
            {j.competency && <p>Kompetensi: {j.competency}</p>}
            {j.attachmentType && (
              <Button variant="secondary" onClick={() => void openAttachment(j)}>
                Lihat lampiran
              </Button>
            )}
            {j.reviewNote && (
              <p>
                Catatan {j.reviewer ?? 'pembimbing'}: {j.reviewNote}
              </p>
            )}
            {j.canReview && j.status === 'submitted' && <ReviewButtons schoolId={schoolId} journal={j} onDone={load} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewButtons({ schoolId, journal, onDone }: { schoolId: string; journal: PklJournal; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  async function send(decision: 'approved' | 'revision') {
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      await api(`/pkl/journals/${journal.id}/review`, PklJournal, { method: 'POST', schoolId, idempotencyKey: key.current, body: decision === 'approved' ? { decision } : { decision, note: note.trim() } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {asking && (
        <label>
          Apa yang perlu diperbaiki?
          <textarea
            value={note}
            maxLength={300}
            rows={2}
            onChange={(e) => {
              key.current = null;
              setNote(e.target.value);
            }}
          />
        </label>
      )}
      {!asking && (
        <Button disabled={busy} onClick={() => void send('approved')}>
          Setujui
        </Button>
      )}{' '}
      <Button variant="secondary" disabled={busy || (asking && note.trim() === '')} onClick={() => {
          if (asking) void send('revision');
          else {
            key.current = null;
            setAsking(true);
          }
        }}
      >
        {asking ? 'Kirim permintaan revisi' : 'Minta revisi'}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
