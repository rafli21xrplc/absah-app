'use client';

import { LIAISON_MESSAGE_MAX, LiaisonThread } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { messageTime, SENDER_LABELS } from '@/lib/liaison';
import styles from './thread.module.css';

/**
 * One student's buku penghubung (ORT-07), shared by the staff web and the parents' portal. Reading
 * marks the thread read; the sender may retract a message for 15 minutes. The admin reads only.
 */
export function LiaisonThreadView({ schoolId, studentId, timezone }: { schoolId: string; studentId: string; timezone: string }) {
  const [thread, setThread] = useState<LiaisonThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // One key per message until it went through; editing the text makes it another message.
  const key = useRef<string | null>(null);

  const load = useCallback(() => {
    api(`/liaison/students/${studentId}`, LiaisonThread, { schoolId })
      .then((t) => {
        setThread(t);
        setError(null);
        if (t.messages.length > 0) void api(`/liaison/students/${studentId}/read`, z.null(), { method: 'POST', schoolId }).catch(() => undefined);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat pesan. Periksa internet.'));
  }, [schoolId, studentId]);

  useEffect(() => {
    load();
    // New replies show up while the page is open.
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      setThread(await api(`/liaison/students/${studentId}/messages`, LiaisonThread, { method: 'POST', schoolId, idempotencyKey: key.current, body: { body: text } }));
      key.current = null;
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Pesan belum terkirim. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function retract(messageId: string) {
    if (!window.confirm('Tarik pesan ini? Penerima tidak bisa membacanya lagi.')) return;
    try {
      setThread(await api(`/liaison/messages/${messageId}/retract`, LiaisonThread, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey() }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Pesan belum ditarik.');
    }
  }

  return (
    <>
      {thread && (
        <p>
          <strong>{thread.student.name}</strong>
          {thread.student.className && ` · ${thread.student.className}`}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {thread && thread.messages.length === 0 && <p>Belum ada pesan.</p>}
      <ol className={styles.messages} aria-label="Pesan">
        {thread?.messages.map((m) => (
          <li key={m.id} className={m.mine ? styles.mine : styles.message}>
            <span className={styles.meta}>
              {m.mine ? 'Anda' : `${m.sender.name} (${SENDER_LABELS[m.senderRole]})`} · {messageTime(timezone, m.createdAt)}
            </span>
            {m.body === null ? <span className={styles.retracted}>Pesan ditarik</span> : m.body}
            {m.body !== null && m.retractedAt && <span className={styles.meta}>Ditarik pengirim</span>}
            {m.canRetract && (
              <button type="button" className={styles.link} onClick={() => void retract(m.id)}>
                Tarik pesan
              </button>
            )}
          </li>
        ))}
      </ol>
      {thread?.canPost ? (
        <form className={styles.compose} onSubmit={(e) => void send(e)}>
          <label htmlFor="pesan">Tulis pesan</label>
          <textarea
            id="pesan"
            value={text}
            maxLength={LIAISON_MESSAGE_MAX}
            onChange={(e) => {
              key.current = null;
              setText(e.target.value);
            }}
          />
          <Button type="submit" disabled={busy || !text.trim()}>
            {busy ? 'Mengirim…' : 'Kirim'}
          </Button>
        </form>
      ) : (
        thread && <p>Admin hanya dapat membaca buku penghubung.</p>
      )}
    </>
  );
}
