'use client';

import { TppkMemberList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../shell.module.css';

/** Home cards: the board for TPPK members, the team page for the admin (with the below-3 warning). */
export function TppkCards() {
  const { schoolId, me, isAdmin } = useWorkspace();
  const [team, setTeam] = useState<TppkMemberList | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/tppk/members', TppkMemberList, { schoolId })
      .then(setTeam)
      .catch(() => undefined);
  }, [schoolId]);

  if (!team) return null;
  const member = team.items.some((m) => m.userId === me.user.id);
  return (
    <>
      {member && (
        <Link className={styles.card} href="/tppk">
          TPPK: laporan dan kasus
        </Link>
      )}
      {isAdmin && (
        <Link className={styles.card} href="/tppk/tim">
          Tim TPPK
          {team.belowMinimum && (
            <>
              <br />
              <small>Kurang dari {team.minimum} anggota</small>
            </>
          )}
        </Link>
      )}
    </>
  );
}
