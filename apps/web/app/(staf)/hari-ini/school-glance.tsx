'use client';

import { TodayResponse } from '@absah/contracts';
import { percentText, ProgressBar, SkeletonRows, SummaryCard, messages } from '@absah/ui';
import { CircleCheck, ClipboardList, Clock, Hourglass } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { groupToday } from '@/lib/session-clock';

const t = messages.today;

/**
 * V11: what a leader (admin, kepsek, wakasek, piket) sees on "Sesi saya" when they teach nothing today: the school's own
 * day in four cards, from the same /attendance/today?scope=all as "Semua sesi". Silent when it cannot be read: the empty
 * state above already says where to go.
 */
export function SchoolGlance({ schoolId, nowMinutes }: { schoolId: string; nowMinutes: number }) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    api('/attendance/today?scope=all', TodayResponse, { schoolId })
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [schoolId]);
  const groups = useMemo(() => (data ? groupToday(data.sessions, nowMinutes) : null), [data, nowMinutes]);
  if (failed) return null;
  if (!data || !groups) return <SkeletonRows count={2} />;
  const total = data.sessions.length;
  const done = groups.done.filter((s) => s.status !== 'missed').length;
  const missed = groups.done.length - done;
  const toFill = groups.current.length + groups.unfilled.length;
  return (
    <section aria-labelledby="sekolah-hari-ini" className="flex flex-col gap-3">
      <div className="flex flex-col">
        <h2 id="sekolah-hari-ini" className="m-0 text-h2">
          {t.glanceTitle}
        </h2>
        <p className="m-0 text-small text-tinta-muted">{total === 0 ? t.glanceNoSessions : t.glanceSub}</p>
      </div>
      {total > 0 && (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
          <li className="flex">
            <SummaryCard
              title={t.statDone}
              icon={CircleCheck}
              value={String(done)}
              unit={t.statOf.replace('{n}', String(total))}
              bar={<ProgressBar bare label={t.statDone} value={done} max={total} unit={t.sessionsUnit} />}
              note={t.statShare.replace('{pct}', percentText(done / total))}
            />
          </li>
          <li className="flex">
            <SummaryCard title={t.statToFill} icon={Clock} iconTone="telat" value={String(toFill)} unit={t.sessionsUnit} note={missed > 0 ? t.glanceMissed.replace('{n}', String(missed)) : t.statToFillNote} />
          </li>
          <li className="flex">
            <SummaryCard
              title={t.statNext}
              icon={Hourglass}
              iconTone="izin"
              value={String(groups.next.length)}
              unit={t.sessionsUnit}
              note={groups.next[0]?.period ? t.statNextAt.replace('{time}', groups.next[0].period.startsAt.replace(':', '.')) : t.statNoNext}
            />
          </li>
          <li className="flex">
            <SummaryCard title={t.statTotal} icon={ClipboardList} value={String(total)} unit={t.sessionsUnit} note={t.statAbsent.replace('{n}', String(groups.done.reduce((n, x) => n + x.counts.absent, 0)))} />
          </li>
        </ul>
      )}
    </section>
  );
}
