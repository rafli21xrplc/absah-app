'use client';

import { Button } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readSeen, unseenReleases, writeSeen, type Release } from '@/lib/changelog';
import { useWorkspace } from '@/lib/workspace';
import styles from './changelog.module.css';
import { useReleases } from './changelog-context';
import { ReleaseNotes } from './release-notes';

/**
 * "Yang baru di Absah" on the home page (PLT-08): the releases a person has not seen, shown until they press "Mengerti".
 * What was seen is remembered per user on this device (localStorage, best effort), so it comes back on another phone.
 */
export function ChangelogNotice() {
  const releases = useReleases();
  const { me } = useWorkspace();
  const userId = me.user.id;
  const [shown, setShown] = useState<Release[]>([]);

  useEffect(() => {
    // After mount only: localStorage exists in the browser alone.
    void Promise.resolve().then(() => setShown(unseenReleases(releases, readSeen(userId))));
  }, [userId, releases]);

  const newest = shown[0];
  if (!newest) return null;
  return (
    <section className={styles.card} aria-labelledby="yang-baru">
      <h2 id="yang-baru" className={styles.heading}>
        Yang baru di Absah
      </h2>
      {shown.map((release) => (
        <ReleaseNotes key={release.id} release={release} level={3} />
      ))}
      <div className={styles.actions}>
        <Button
          onClick={() => {
            writeSeen(userId, newest.id);
            setShown([]);
          }}
        >
          Mengerti
        </Button>
        <Link href="/rilis">Lihat semua rilis</Link>
      </div>
    </section>
  );
}
