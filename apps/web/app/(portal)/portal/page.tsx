'use client';

import { CardDeviceKeys, LeaveRequestList, MyCards, PortalAttendance } from '@absah/contracts';
import { Banner, Button, Card, CountsRow, ErrorState, LinkRow, PageMain, SegmentedControl, SkeletonRows, PortalStatusChip, messages, type StatusCode } from '@absah/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { IfCap, useCapability } from '@/lib/capabilities';
import { loadKeys, storeKeys } from '@/lib/card';
import { timeIn } from '@/lib/gate';
import { dateRangeLabel, LEAVE_KIND_LABELS, LEAVE_STATUS_LABELS } from '@/lib/leave';
import { isTransient } from '@/lib/offline-queue';
import { HISTORY_RANGES, type HistoryRange } from '@/lib/portal-children';
import { useWorkspace } from '@/lib/workspace';
import { CardQr } from '../card-qr';
import { useChildren } from './children';

const t = messages.portal;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

const dayLabel = (date: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T00:00:00Z`));

/** PWA siswa (ORT-02; U7a): today, the dynamic card, and the history. Also serves parents' children. */
export default function PortalHome() {
  const router = useRouter();
  const { me, schoolId, hasRole, selectSchool } = useWorkspace();
  const kaih = useCapability('habits.kaih');
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const allowed = hasRole('siswa', 'orang_tua');
  const { selected, status: childrenStatus, children: kids } = useChildren();
  const parent = hasRole('orang_tua');
  const [days, setDays] = useState<HistoryRange>(30);
  const [data, setData] = useState<PortalAttendance | null>(null);
  const [failure, setFailure] = useState<'error' | 'offline' | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A parent sees one child at a time (picked at the top, any school); a siswa sees themselves.
  const ready = parent ? selected !== null && selected.schoolId === schoolId : true;
  useEffect(() => {
    if (!schoolId || !allowed || !ready) return;
    const query = new URLSearchParams({ days: String(days) });
    if (parent && selected) query.set('studentId', selected.studentId);
    api(`/portal/attendance?${query.toString()}`, PortalAttendance, { schoolId })
      .then((res) => {
        setData(res);
        setFailure(null);
      })
      .catch((err: unknown) => setFailure(isTransient(err) ? 'offline' : 'error'));
  }, [schoolId, allowed, ready, parent, selected, days, attempt]);

  async function leave() {
    await signOut();
    router.replace('/masuk/hp');
  }

  if (!schoolId && (childrenStatus === 'loading' || kids.length > 0)) return <SkeletonRows count={3} />;
  if (!schoolId) {
    return (
      <PageMain>
        <h1 className="m-0 text-h1">{t.chooseSchool}</h1>
        <div className="flex flex-col gap-2">
          {me.schools.map((s) => (
            <Button key={s.id} variant="secondary" onClick={() => selectSchool(s.id)}>
              {s.name}
            </Button>
          ))}
        </div>
      </PageMain>
    );
  }
  if (!allowed) {
    return (
      <PageMain>
        <p className="m-0 text-body">{t.forbidden}</p>
        {hasRole('pembimbing_industri') ? <Link href="/dudi">{t.toIndustry}</Link> : <Link href="/">{t.toStaff}</Link>}
      </PageMain>
    );
  }

  return (
    <PageMain>
      <header className="flex flex-col gap-1">
        <p className="m-0 text-small text-tinta-muted">{me.schools.find((s) => s.id === schoolId)?.name}</p>
        <h1 className="m-0 text-h1">{fill(t.hello, { name: me.user.name.split(/\s+/)[0] ?? '' })}</h1>
      </header>
      {failure === 'offline' && <Banner kind="offline">{t.offlineBody}</Banner>}
      {failure === 'error' && (
        <ErrorState title={t.loadFailed} onRetry={() => { setFailure(null); setAttempt((n) => n + 1); }}>
          {t.loadFailedBody}
        </ErrorState>
      )}
      {!data && !failure && <SkeletonRows count={3} />}
      <IfCap name="gate.enabled">
        <Cards schoolId={schoolId} only={parent ? selected?.studentId : undefined} />
      </IfCap>
      <nav aria-label="Menu portal" className="flex flex-col gap-2">
        {kaih && kaih !== 'off' && <LinkRow linkAs={Link} href="/portal/kebiasaan" title={t.linkHabits} detail={t.linkHabitsBody} />}
        {hasRole('siswa') && (
          <IfCap name="pkl.enabled">
            <LinkRow linkAs={Link} href="/portal/pkl" title={t.linkPkl} detail={t.linkPklBody} />
          </IfCap>
        )}
        <IfCap name="religious.memorization">
          <LinkRow linkAs={Link} href="/portal/hafalan" title={t.linkMemorization} detail={t.linkMemorizationBody} />
        </IfCap>
        <IfCap name="exam.enabled">
          <LinkRow linkAs={Link} href="/portal/ujian" title={t.linkExam} detail={t.linkExamBody} />
        </IfCap>
        <IfCap name="student.billing">
          <LinkRow linkAs={Link} href="/portal/tagihan" title={t.linkBilling} detail={t.linkBillingBody} />
        </IfCap>
        {hasRole('orang_tua') && <LinkRow linkAs={Link} href="/portal/preferensi" title={t.linkPrefs} detail={t.linkPrefsBody} />}
        {hasRole('orang_tua') && (
          <IfCap name="gate.pickup">
            <LinkRow linkAs={Link} href="/portal/penjemput" title={t.linkPickup} detail={t.linkPickupBody} />
          </IfCap>
        )}
        {hasRole('orang_tua') && (
          <IfCap name="portal.liaison">
            <LinkRow linkAs={Link} href="/portal/penghubung" title={t.linkLiaison} detail={t.linkLiaisonBody} />
          </IfCap>
        )}
      </nav>
      <SegmentedControl
        label={t.range}
        value={String(days) as `${HistoryRange}`}
        onChange={(v) => setDays(Number(v) as HistoryRange)}
        options={HISTORY_RANGES.map((r) => ({ value: String(r) as `${HistoryRange}`, label: fill(t.rangeDays, { n: r }) }))}
      />
      {data?.items.map((s) => (
        <Card as="section" key={s.studentId} aria-label={fill(t.attendanceOf, { name: s.name })} className="flex flex-col gap-3">
          <h2 className="m-0 text-h2">
            {s.name} · {s.className}
          </h2>
          <p className="m-0 flex flex-wrap items-center gap-2 text-body">
            {t.today}: <PortalStatusChip code={s.today.status as StatusCode | null} empty={t.notRecorded} />
            {s.today.arrivedAt && <span className="text-tinta-muted"> · {fill(t.arrived, { time: timeIn(timezone, s.today.arrivedAt) })}</span>}
          </p>
          <CountsRow label={fill(t.countsOf, { n: days })} counts={s.counts} />
          {s.days.length === 0 ? (
            <p className="m-0 text-body text-tinta-muted">{fill(t.noRecap, { n: days })}</p>
          ) : (
            <ul aria-label={t.history} className="m-0 flex list-none flex-col gap-1 p-0">
              {s.days.map((d) => (
                <li key={d.date} className="flex min-h-11 items-center justify-between gap-3 border-b border-garis py-1 last:border-b-0">
                  <span>{dayLabel(d.date)}</span>
                  <PortalStatusChip code={d.status as StatusCode} />
                </li>
              ))}
            </ul>
          )}
          {parent && <ChildLeave schoolId={schoolId} enrollmentId={s.enrollmentId} />}
        </Card>
      ))}
      <Button variant="secondary" onClick={() => void leave()}>
        {t.signOut}
      </Button>
    </PageMain>
  );
}

/** Cards this account holds; each is bound to this phone once and then works offline for a week. */
function Cards({ schoolId, only }: { schoolId: string; only?: string }) {
  const [cards, setCards] = useState<MyCards['items']>([]);
  useEffect(() => {
    api('/cards/mine', MyCards, { schoolId })
      .then((c) => setCards(c.items))
      .catch(() => setCards([]));
  }, [schoolId]);
  return (
    <>
      {cards
        .filter((c) => !only || c.studentId === only)
        .map((c) => (
          <StudentCard key={c.studentId} schoolId={schoolId} studentId={c.studentId} name={c.name.split(/\s+/)[0] ?? c.name} />
        ))}
    </>
  );
}

function StudentCard({ schoolId, studentId, name }: { schoolId: string; studentId: string; name: string }) {
  const storageKey = `absah.card.${studentId}`;
  const [keys, setKeys] = useState<CardDeviceKeys | null>(() => loadKeys(storageKey));
  const [lost, setLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh day keys while online; a 404 means another phone took the card over.
  useEffect(() => {
    const stored = loadKeys(storageKey);
    if (!stored) return;
    api(`/cards/devices/${stored.deviceId}/keys`, CardDeviceKeys, { schoolId })
      .then((k) => {
        storeKeys(storageKey, k);
        setKeys(k);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          storeKeys(storageKey, null);
          setKeys(null);
          setLost(true);
        }
      });
  }, [schoolId, storageKey]);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const k = await api('/cards/devices', CardDeviceKeys, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { studentId, label: 'Aplikasi Absah' } });
      storeKeys(storageKey, k);
      setKeys(k);
      setLost(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.cardFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" aria-labelledby={`kartu-${studentId}`} className="flex flex-col gap-3">
      <h2 id={`kartu-${studentId}`} className="m-0 text-h2">
        {fill(t.cardTitle, { name })}
      </h2>
      {keys ? (
        <CardQr keys={keys} name={name} />
      ) : (
        <>
          <p className="m-0 text-body text-tinta-muted">
            {lost ? t.cardLost : t.cardInactive} {t.cardNote}
          </p>
          <Button loading={busy} onClick={() => void activate()}>
            {t.cardActivate}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="m-0 text-body text-alpa">
          {error}
        </p>
      )}
    </Card>
  );
}

/** The child's izin, newest first (parents can already read their children's requests, ORT-05). */
function ChildLeave({ schoolId, enrollmentId }: { schoolId: string; enrollmentId: string }) {
  const [items, setItems] = useState<LeaveRequestList['items'] | null>(null);
  useEffect(() => {
    api('/leave-requests?status=all', LeaveRequestList, { schoolId })
      .then((res) => setItems(res.items.filter((l) => l.student.enrollmentId === enrollmentId).slice(0, 10)))
      .catch(() => setItems([]));
  }, [schoolId, enrollmentId]);
  if (!items || items.length === 0) return null;
  return (
    <>
      <h3 className="m-0 text-body-strong">{t.leaveTitle}</h3>
      <ul aria-label={t.leaveList} className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((l) => (
          <li key={l.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-garis py-1 last:border-b-0">
            <span>
              {LEAVE_KIND_LABELS[l.kind]} · {dateRangeLabel(l.startsOn, l.endsOn)}
            </span>
            <span className="text-body-strong">{LEAVE_STATUS_LABELS[l.status]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
