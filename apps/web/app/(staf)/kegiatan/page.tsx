'use client';

import { Activity, ActivityList, SchoolMembersResponse, type ActivityKind, type ActivityLocation } from '@absah/contracts';
import { Badge, Button, CountList, cx, DataCard, DataHeader, DateInput, Dialog, EmptyState, ErrorState, Input, messages, PageMain, Pagination, SearchBox, SegmentedControl, Select, SkeletonRows, StatCard, usePaged } from '@absah/ui';
import { CalendarCheck, MapPin, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ACTIVITY_MANAGERS, ACTIVITY_OVERSEERS, DAY_LABELS, DAYS, KIND_LABELS, KINDS, LOCATION_LABELS, LOCATIONS, scheduleLabel } from '@/lib/activities';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { staffCandidates } from '@/lib/tppk';
import { useCapability } from '@/lib/capabilities';
import { todayIn } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';

const t = messages.activityPage;
const PAGE = 8;
const FORM_ID = 'kegiatan-baru';

/** Kegiatan (KEG-01): managers see and create all; a pembina sees the activities they coach. PG1: stat cards + card grid. */
export default function KegiatanPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const manager = hasRole(...ACTIVITY_MANAGERS);
  // Overseers (kepsek, operator too) get every activity from the API, not only the ones they coach.
  const overseer = hasRole(...ACTIVITY_OVERSEERS);
  const timezone = me.schools.find((x) => x.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const today = todayIn(timezone);
  const [state, setState] = useState<'active' | 'inactive' | 'all'>('active');
  const [list, setList] = useState<ActivityList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'' | ActivityKind>('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/activities', ActivityList, { schoolId })
      .then((r) => {
        setError(null);
        setList(r);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : t.loadFailed));
  }, [schoolId]);
  useEffect(load, [load]);

  const items = useMemo(() => list?.items ?? [], [list]);
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      items.filter(
        (a) =>
          (state === 'all' || a.active === (state === 'active')) &&
          (!kind || a.kind === kind) &&
          (!q || a.name.toLowerCase().includes(q) || a.coaches.some((c) => c.name.toLowerCase().includes(q))),
      ),
    [items, state, kind, q],
  );
  const paged = usePaged(shown, PAGE);
  const active = items.filter((a) => a.active);
  const todayList = active.filter((a) => meetsOn(a, today));
  const members = active.reduce((n, a) => n + a.memberCount, 0);

  return (
    <PageMain width="xl">
      <DataHeader
        title={t.title}
        subtitle={overseer ? t.subtitleManager : t.subtitleCoach}
        {...(manager
          ? {
              actions: (
                <Button size="48" onClick={() => setCreating(true)}>
                  {t.new}
                </Button>
              ),
            }
          : {})}
      />

      {list && items.length > 0 && (
        <ul aria-label={t.summary} className="m-0 grid list-none grid-cols-2 gap-3 p-0 xl:grid-cols-4">
          <li className="flex">
            <StatCard className="flex-1" title={t.statToday} tone="papan" icon={CalendarCheck} value={todayList.length} unit={t.activities} note={todayList.length > 0 ? todayList.map((a) => a.name).join(', ') : t.todayNone} />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.statActive} tone="hadir" icon={Sparkles} value={active.length} unit={t.activities} parts={[{ value: items.length - active.length, label: t.inactiveLower }]} />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.statMembers} tone="izin" icon={Users} value={members} unit={t.students} note={active.length > 0 ? t.avgMembers.replace('{n}', String(Math.round(members / active.length))) : t.membersNote} />
          </li>
          <li className="flex">
            <StatCard className="flex-1" title={t.statOutside} tone="sakit" icon={MapPin} value={active.filter((a) => a.location === 'luar_sekolah').length} unit={t.activities} note={t.outsideNote} />
          </li>
        </ul>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <DataCard
        title={t.listTitle}
        {...(list ? { aside: t.count.replace('{n}', String(shown.length)) } : {})}
        toolbar={
          <>
            <SearchBox label={t.search} value={query} onChange={setQuery} className="w-56" />
            <label className="flex items-center gap-2 text-small text-tinta-muted">
              {t.kind}
              <Select value={kind} onChange={(e) => setKind(e.target.value as '' | ActivityKind)}>
                <option value="">{t.allKinds}</option>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </label>
            <SegmentedControl
              label={t.stateLabel}
              value={state}
              onChange={setState}
              options={[
                { value: 'active', label: t.stateActive, count: active.length },
                { value: 'inactive', label: t.stateInactive, count: items.length - active.length },
                { value: 'all', label: t.stateAll, count: items.length },
              ]}
            />
          </>
        }
        footer={<Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} size={PAGE} onPage={paged.setPage} />}
      >
        {error && <ErrorState headingLevel="h3" title={error} onRetry={load} />}
        {!list && !error && <SkeletonRows count={3} />}
        {list && shown.length === 0 && <EmptyState bare headingLevel="h3" title={items.length === 0 ? (overseer ? t.emptyManager : t.emptyCoach) : t.noMatch} />}
        {shown.length > 0 && (
          <ul aria-label={t.listLabel} className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
            {paged.slice.map((a) => {
              const isToday = a.active && meetsOn(a, today);
              return (
                <li key={a.id} className="flex min-w-0">
                  <Link
                    href={`/kegiatan/${a.id}`}
                    className="box-border flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-garis bg-kapur-raised p-4 text-tinta no-underline hover:border-papan hover:bg-papan-tipis"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-small font-semibold text-papan">{KIND_LABELS[a.kind]}</span>
                      <span className="flex-1" />
                      {isToday && <Badge tone="papan">{t.todayBadge}</Badge>}
                      {!a.active && <Badge tone="netral">{t.inactive}</Badge>}
                      <Badge tone={a.location === 'sekolah' ? 'hadir' : 'sakit'}>{LOCATION_LABELS[a.location]}</Badge>
                    </span>
                    <span className="truncate text-body-strong">{a.name}</span>
                    <span className="flex items-center gap-1" aria-label={scheduleLabel(a)}>
                      {DAYS.map((d) => (
                        <span
                          key={d}
                          aria-hidden
                          className={cx('inline-flex h-6 min-w-0 flex-1 items-center justify-center rounded-sm text-small', a.days.includes(d) ? 'bg-papan-soft font-bold text-papan' : 'bg-kapur text-tinta-muted')}
                        >
                          {DAY_LABELS[d]}
                        </span>
                      ))}
                    </span>
                    {(a.startsOn || a.endsOn || a.days.length === 0) && <span className="text-small text-tinta-muted">{scheduleLabel(a)}</span>}
                    <span className="mt-auto flex items-center justify-between gap-2 border-t border-garis pt-2 text-small text-tinta-muted">
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden className="flex shrink-0 -space-x-2">
                          {a.coaches.slice(0, 3).map((c) => (
                            <span key={c.id} className="inline-flex size-7 items-center justify-center rounded-full border-2 border-kapur-raised bg-papan-soft text-small font-bold text-papan">
                              {c.name.charAt(0).toUpperCase()}
                            </span>
                          ))}
                        </span>
                        <span className="truncate">Pembina: {a.coaches.map((c) => c.name).join(', ')}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-body-strong text-tinta">
                        <Users aria-hidden strokeWidth={1.75} className="size-4 text-tinta-muted" />
                        {a.memberCount} peserta
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DataCard>

      <div className="flex min-w-0 flex-col gap-4">
        <DataCard title={t.weekTitle} aside={t.weekAside}>
          <ul aria-label={t.weekTitle} className="m-0 flex list-none flex-col p-0">
            {DAYS.map((d) => {
              const on = active.filter((a) => a.days.includes(d));
              const isToday = d === weekdayOf(today);
              return (
                <li key={d} className={cx('flex items-start gap-3 border-b border-garis py-2 last:border-b-0', isToday && 'rounded-md bg-papan-tipis px-2')}>
                  <span className={cx('w-10 shrink-0 text-small font-bold', isToday ? 'text-papan' : 'text-tinta')}>
                    {DAY_LABELS[d]}
                    {isToday && <span className="sr-only"> ({t.todayBadge})</span>}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {on.length === 0 ? <span className="text-small text-tinta-muted">–</span> : on.map((a) => <Badge key={a.id} tone={isToday ? 'papan' : 'netral'}>{a.name}</Badge>)}
                  </span>
                </li>
              );
            })}
          </ul>
        </DataCard>
        <DataCard title={t.topTitle}>
          {active.length > 0 ? (
            <CountList
              label={t.topTitle}
              tone="izin"
              rows={[...active]
                .sort((x, y) => y.memberCount - x.memberCount)
                .slice(0, 6)
                .map((a) => ({ key: a.id, label: a.name, detail: KIND_LABELS[a.kind], value: a.memberCount, text: `${a.memberCount} siswa` }))}
            />
          ) : (
            <p className="m-0 text-small text-tinta-muted">{manager ? t.emptyManager : t.emptyCoach}</p>
          )}
        </DataCard>
      </div>
      </div>

      {manager && (
        <Dialog
          open={creating}
          onOpenChange={setCreating}
          title={t.newTitle}
          description={t.newDescription}
          actions={
            <Button type="submit" form={FORM_ID}>
              {t.save}
            </Button>
          }
        >
          <NewActivity
            schoolId={schoolId}
            onDone={() => {
              setCreating(false);
              load();
            }}
          />
        </Dialog>
      )}
    </PageMain>
  );
}

function NewActivity({ schoolId, onDone }: { schoolId: string | null; onDone: () => void }) {
  const [staff, setStaff] = useState<{ userId: string; name: string }[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ActivityKind>('ekskul');
  // KEG-03: ibadah berjamaah only where religious.worship is on (the API refuses it otherwise).
  const worship = useCapability('religious.worship') === true;
  const [location, setLocation] = useState<ActivityLocation>('sekolah');
  const [days, setDays] = useState<number[]>([]);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [coachIds, setCoachIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const changed = () => {
    key.current = null;
  };

  useEffect(() => {
    if (!schoolId) return;
    api('/school/members', SchoolMembersResponse, { schoolId })
      .then((r) => setStaff(staffCandidates(r.items)))
      .catch(() => setStaff([]));
  }, [schoolId]);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Tulis nama kegiatan.');
    if (coachIds.length === 0) return setError('Pilih minimal satu pembina.');
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), kind, location, days, coachIds, ...(startsOn ? { startsOn } : {}), ...(endsOn ? { endsOn } : {}) };
      await api('/activities', Activity, { method: 'POST', schoolId, idempotencyKey: key.current, body });
      key.current = null;
      setName('');
      setDays([]);
      setStartsOn('');
      setEndsOn('');
      setCoachIds([]);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id={FORM_ID} className="flex flex-col gap-4" onSubmit={(e) => void submit(e)} aria-label={t.newTitle}>
      <label className={FIELD}>
        Nama kegiatan
        <Input
          value={name}
          maxLength={100}
          onChange={(e) => {
            changed();
            setName(e.target.value);
          }}
        />
      </label>
      <label className={FIELD}>
        Jenis
        <Select
          value={kind}
          onChange={(e) => {
            changed();
            setKind(e.target.value as ActivityKind);
          }}
        >
          {KINDS.filter((k) => k !== 'ibadah' || worship).map((k) => (
            <option key={k} value={k}>
              {k === 'ibadah' ? 'Ibadah berjamaah' : KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </label>
      <fieldset className={SET}>
        <legend className={LEGEND}>Tempat</legend>
        {LOCATIONS.map((l) => (
          <label key={l} className={CHIP}>
            <input
              type="radio"
              name="location"
              checked={location === l}
              onChange={() => {
                changed();
                setLocation(l);
              }}
            />{' '}
            {LOCATION_LABELS[l]}
          </label>
        ))}
        <span className="basis-full text-small font-normal text-tinta-muted">Peserta kegiatan di luar sekolah tidak dihitung dalam prakiraan porsi MBG.</span>
      </fieldset>
      <fieldset className={SET}>
        <legend className={LEGEND}>Hari (kosongkan untuk kegiatan beberapa hari berturut-turut, isi tanggal mulai dan selesai)</legend>
        {DAYS.map((d) => (
          <label key={d} className={CHIP}>
            <input
              type="checkbox"
              checked={days.includes(d)}
              onChange={() => {
                changed();
                setDays((x) => toggle(x, d));
              }}
            />{' '}
            {DAY_LABELS[d]}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className={FIELD}>
        Tanggal mulai (boleh kosong)
        <DateInput
          type="date"
          value={startsOn}
          onChange={(e) => {
            changed();
            setStartsOn(e.target.value);
          }}
        />
      </label>
      <label className={FIELD}>
        Tanggal selesai (boleh kosong)
        <DateInput
          type="date"
          value={endsOn}
          onChange={(e) => {
            changed();
            setEndsOn(e.target.value);
          }}
        />
      </label>
      </div>
      <fieldset className={SET}>
        <legend className={LEGEND}>Pembina</legend>
        {staff.map((s) => (
          <label key={s.userId} className={CHIP}>
            <input
              type="checkbox"
              checked={coachIds.includes(s.userId)}
              onChange={() => {
                changed();
                setCoachIds((x) => toggle(x, s.userId));
              }}
            />{' '}
            {s.name}
          </label>
        ))}
      </fieldset>
      {error && (
        <p className="m-0 text-body-strong text-alpa" role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status" className="m-0 text-small text-tinta-muted">{t.saving}</p>}
    </form>
  );
}

/** Does an active activity meet on this school date: a listed weekday (1 = Senin) inside its optional dates, or any day of a dated
 * run without weekdays. */
function meetsOn(a: { days: number[]; startsOn: string | null; endsOn: string | null }, date: string): boolean {
  if ((a.startsOn && date < a.startsOn) || (a.endsOn && date > a.endsOn)) return false;
  if (a.days.length === 0) return Boolean(a.startsOn || a.endsOn);
  return a.days.includes(weekdayOf(date));
}

/** ISO weekday (1 = Senin) of a school date. */
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

const FIELD = 'flex flex-col gap-1 text-body-strong';
const SET = 'm-0 flex flex-wrap gap-2 border-0 p-0';
const LEGEND = 'mb-2 p-0 text-body-strong';
const CHIP = 'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-garis bg-kapur-raised px-3 text-body has-[:checked]:border-papan has-[:checked]:bg-papan-soft';
