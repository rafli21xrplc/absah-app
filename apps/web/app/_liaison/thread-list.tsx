'use client';

import { LiaisonThreadList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { messageTime } from '@/lib/liaison';
import styles from './thread.module.css';

/** Threads of the user with unread counts; `base` is where one opens (/penghubung or /portal/penghubung). */
export function LiaisonThreads({ schoolId, timezone, base, empty }: { schoolId: string; timezone: string; base: string; empty: string }) {
  const [list, setList] = useState<LiaisonThreadList | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api('/liaison/threads', LiaisonThreadList, { schoolId })
      .then(setList)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat buku penghubung.'));
  }, [schoolId]);

  return (
    <>
      {error && <p role="alert">{error}</p>}
      {list && list.items.length === 0 && <p>{empty}</p>}
      <ul className={styles.messages} aria-label="Buku penghubung">
        {list?.items.map((t) => (
          <li key={t.studentId}>
            <Link className={styles.message} href={`${base}/${t.studentId}`}>
              <strong>{t.studentName}</strong>
              {t.className && ` · ${t.className}`}
              <span className={styles.meta}>
                {t.lastMessageAt ? messageTime(timezone, t.lastMessageAt) : 'Belum ada pesan'}
                {t.unread > 0 && ` · ${t.unread} belum dibaca`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
