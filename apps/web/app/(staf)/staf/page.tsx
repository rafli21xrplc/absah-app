'use client';

import { InvitationResponse, SchoolMember, SchoolMembersResponse, STAFF_ROLES, type MembershipStatus, type StaffRole } from '@absah/contracts';
import { Banner, Button, DataHeader, DataToolbar, Dialog, Drawer, EmptyState, ErrorState, Field, Input, PageMain, SegmentedControl, Select, SkeletonRows, Table, TableBody, TableHead, TableRow, Td, Th, messages } from '@absah/ui';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { toE164 } from '@/lib/phone';
import { ROLE_LABELS } from '@/lib/roles';
import { STAFF_MANAGERS, STAFF_READERS } from '@/lib/staff-access';
import { useSection } from '@/lib/use-section';
import { useWorkspace } from '@/lib/workspace';

const t = messages.staff;
const d = messages.data;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

type Filter = 'all' | MembershipStatus;
const FILTERS = [
  { value: 'all', label: t.statusAll },
  { value: 'active', label: t.statusActive },
  { value: 'invited', label: t.statusInvited },
  { value: 'suspended', label: t.statusSuspended },
] as const;
const PILL: Record<MembershipStatus, { text: string; look: string }> = {
  active: { text: t.pillActive, look: 'text-hadir' },
  invited: { text: t.pillInvited, look: 'text-telat' },
  suspended: { text: t.pillSuspended, look: 'text-tinta-muted' },
};
/** Pembimbing industri comes from the PKL partner flow, not from this list. */
const INVITE_ROLES = STAFF_ROLES.filter((r) => r !== 'pembimbing_industri');

/**
 * Guru dan staf (U6e; new page): who has access to the school and in which role. One row per membership, because that is what the API
 * suspends: a person with two roles has two rows. Not on this page because the API has no endpoint: Import PTK Dapodik, Ubah peran,
 * Kirim ulang undangan from the list (inviting again replaces the link), mapel and rombel taught, NUPTK.
 */
export default function StafPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const allowed = hasRole(...STAFF_READERS);
  const canManage = hasRole(...STAFF_MANAGERS);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const section = useSection(`${schoolId ?? ''}:members`, schoolId && allowed ? () => api('/school/members', SchoolMembersResponse, { schoolId }) : null, (x) => x.items.length === 0);
  const [done, setDone] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  /** A new number each time the drawer opens: it starts empty, with no leftover link or key. */
  const [inviteRound, setInviteRound] = useState(0);

  const members = useMemo(() => [...(section.data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'id') || a.role.localeCompare(b.role)), [section.data]);
  const roles = useMemo(() => [...new Set(members.map((m) => m.role))], [members]);
  const term = q.trim().toLowerCase();
  const shown = members.filter((m) => (!role || m.role === role) && (filter === 'all' || m.status === filter) && (!term || m.name.toLowerCase().includes(term) || (m.email ?? '').toLowerCase().includes(term)));
  const people = new Set(members.map((m) => m.userId)).size;
  const count = (s: MembershipStatus) => members.filter((m) => m.status === s).length;

  if (!allowed) {
    return (
      <PageMain width="xl">
        <h1 className="m-0 text-h1">{t.title}</h1>
        <p role="alert" className="m-0 text-body">
          {d.forbidden}
        </p>
      </PageMain>
    );
  }

  const subtitle =
    members.length > 0
      ? fill(t.subtitle, { people, active: count('active') }) + (count('invited') > 0 ? fill(t.subtitleInvited, { n: count('invited') }) : '') + (count('suspended') > 0 ? fill(t.subtitleSuspended, { n: count('suspended') }) : '')
      : undefined;

  return (
    <PageMain width="xl">
      <DataHeader title={t.title} subtitle={subtitle} actions={canManage && <Button onClick={() => { setInviteRound((n) => n + 1); setInviteOpen(true); }}>{t.invite}</Button>} />
      {members.length > 0 && (
        <DataToolbar search={{ label: t.searchLabel, value: q, onChange: setQ, placeholder: t.searchPlaceholder }}>
          <Field label={t.roleLabel} className="min-w-52">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">{t.allRoles}</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <SegmentedControl label={t.statusLabel} options={FILTERS} value={filter} onChange={setFilter} />
        </DataToolbar>
      )}
      {canManage && <InviteDrawer key={inviteRound} open={inviteOpen} onOpenChange={setInviteOpen} onInvited={section.reload} onAgain={() => { setInviteRound((n) => n + 1); setInviteOpen(true); }} />}
      {section.state === 'offline' && <Banner kind="offline">{d.offlineBody}</Banner>}
      {done && (
        <p role="status" className="m-0 text-small text-papan">
          {done}
        </p>
      )}
      {section.state === 'error' && (
        <ErrorState title={d.loadFailed} onRetry={section.reload}>
          {d.loadFailedBody}
        </ErrorState>
      )}
      {section.state === 'loading' && <SkeletonRows count={6} />}
      {section.state === 'empty' && <EmptyState title={t.empty}>{canManage ? t.emptyManage : t.emptyRead}</EmptyState>}
      {members.length > 0 && shown.length === 0 && <EmptyState title={t.emptySearch}>{t.emptySearchBody}</EmptyState>}
      {shown.length > 0 && (
        <MemberTable members={shown} canManage={canManage} myUserId={me.user.id} onChanged={(text) => { setDone(text); section.reload(); }} />
      )}
    </PageMain>
  );
}

/** The invite form. Remounted (key) for each opening, so it always starts empty. */
function InviteDrawer({ open, onOpenChange, onInvited, onAgain }: { open: boolean; onOpenChange: (open: boolean) => void; onInvited: () => void; onAgain: () => void }) {
  const { schoolId } = useWorkspace();
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [created, setCreated] = useState<{ name: string; link: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /** One key per attempt: a lost reply and a second tap must not invite twice. */
  const key = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const contact = String(form.get('contact') ?? '').trim();
    const chosen = String(form.get('role')) as StaffRole;
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const res = await api('/school/invitations', InvitationResponse, {
        method: 'POST',
        body: channel === 'email' ? { name, email: contact, role: chosen } : { name, phoneNumber: toE164(contact), role: chosen },
        schoolId,
        idempotencyKey: key.current,
      });
      key.current = null;
      setCreated({ name, link: res.inviteUrl });
      onInvited();
    } catch (err) {
      if (err instanceof ApiError) {
        key.current = null;
        setError(err);
      } else setError(d.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(t.copied);
    } catch {
      setCopied(t.copyFailed);
    }
  }

  const contactError = error instanceof ApiError ? (fieldError(error, 'email') ?? fieldError(error, 'phoneNumber')) : undefined;
  const nameError = error instanceof ApiError ? fieldError(error, 'name') : undefined;
  const general = typeof error === 'string' ? error : error && !contactError && !nameError ? error.message : undefined;

  return (
        <Drawer
          open={open}
          onOpenChange={(next) => !busy && onOpenChange(next)}
          title={t.drawerTitle}
          onSubmit={created ? (e) => { e.preventDefault(); onOpenChange(false); } : (e) => void submit(e)}
          actions={
            created ? (
              <Button type="submit">{t.close}</Button>
            ) : (
              <Button type="submit" loading={busy}>
                {t.send}
              </Button>
            )
          }
        >
          {created ? (
            <>
              <h3 className="m-0 text-body-strong">{fill(t.createdTitle, { name: created.name })}</h3>
              <p className="m-0 text-body text-tinta-muted">{fill(t.createdBody, { name: created.name })}</p>
              <Field label={t.linkLabel}>
                <Input readOnly value={created.link} onFocus={(e) => e.currentTarget.select()} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => void copy(created.link)}>
                  {t.copy}
                </Button>
                {copied && (
                  <span role="status" className="text-small text-tinta-muted">
                    {copied}
                  </span>
                )}
                <Button type="button" variant="secondary" onClick={onAgain}>
                  {t.inviteAnother}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Field label={t.nameLabel} error={nameError}>
                <Input name="name" required minLength={2} autoComplete="off" />
              </Field>
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-1 p-0 text-small font-semibold text-tinta">{t.channelLabel}</legend>
                {(['email', 'whatsapp'] as const).map((c) => (
                  <label key={c} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-garis-kuat bg-kapur-raised px-3 text-body text-tinta">
                    <input type="radio" name="channel" checked={channel === c} onChange={() => setChannel(c)} className="size-5 accent-papan" />
                    {c === 'email' ? t.channelEmail : t.channelWhatsapp}
                  </label>
                ))}
              </fieldset>
              <Field label={channel === 'email' ? t.emailLabel : t.phoneLabel} error={contactError}>
                <Input
                  key={channel}
                  name="contact"
                  type={channel === 'email' ? 'email' : 'tel'}
                  inputMode={channel === 'email' ? 'email' : 'tel'}
                  placeholder={channel === 'email' ? 'nama@sekolah.sch.id' : '0812…'}
                  required
                  autoComplete="off"
                />
              </Field>
              <Field label={t.roleField}>
                <Select name="role" defaultValue="guru">
                  {INVITE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </Field>
              {general && (
                <p role="alert" className="m-0 text-body text-alpa">
                  {general}
                </p>
              )}
            </>
          )}
        </Drawer>
  );
}

function MemberTable({ members, canManage, myUserId, onChanged }: { members: SchoolMember[]; canManage: boolean; myUserId: string; onChanged: (text: string) => void }) {
  const { schoolId } = useWorkspace();
  const [asking, setAsking] = useState<SchoolMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /** One key per (membership, answer), dropped once the API answered. */
  const keys = useRef(new Map<string, string>());

  async function change(m: SchoolMember, status: 'active' | 'suspended'): Promise<boolean> {
    const slot = `${m.membershipId}:${status}`;
    const idempotencyKey = keys.current.get(slot) ?? newIdempotencyKey();
    keys.current.set(slot, idempotencyKey);
    setBusy(true);
    setFailed(null);
    try {
      await api(`/school/members/${m.membershipId}`, SchoolMember, { method: 'PATCH', body: { status }, schoolId, idempotencyKey });
      keys.current.delete(slot);
      onChanged(fill(status === 'suspended' ? t.doneSuspended : t.doneActivated, { name: m.name, role: ROLE_LABELS[m.role] }));
      return true;
    } catch (err) {
      if (err instanceof ApiError) keys.current.delete(slot);
      setFailed(err instanceof ApiError ? err.message : d.saveFailed);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Table caption={t.table} className="min-w-180">
        <TableHead>
          <TableRow>
            <Th>{t.colName}</Th>
            <Th>{t.colRole}</Th>
            <Th>{t.colStatus}</Th>
            {canManage && <Th>{t.colAction}</Th>}
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((m) => {
            const mine = m.userId === myUserId;
            const pill = PILL[m.status];
            const role = ROLE_LABELS[m.role];
            return (
              <TableRow key={m.membershipId}>
                <Th scope="row" className="font-normal">
                  <span className="flex flex-col">
                    <span className="text-body-strong text-tinta">
                      {m.name}
                      {mine && <span className="ml-2 text-small font-normal text-tinta-muted">({t.you})</span>}
                    </span>
                    <span className="text-small text-tinta-muted">{m.email ?? t.noEmail}</span>
                  </span>
                </Th>
                <Td>{role}</Td>
                <Td>
                  <span className={`text-body-strong ${pill.look}`}>{pill.text}</span>
                </Td>
                {canManage && (
                  <Td>
                    {/* The API refuses to change one's own membership, and an invitation is not yet an account to switch. */}
                    {!mine && m.status === 'active' && (
                      <Button variant="secondary" aria-label={fill(t.suspendOf, { name: m.name, role })} onClick={() => { setFailed(null); setAsking(m); }}>
                        {t.suspend}
                      </Button>
                    )}
                    {!mine && m.status === 'suspended' && (
                      <Button variant="secondary" disabled={busy} aria-label={fill(t.activateOf, { name: m.name, role })} onClick={() => void change(m, 'active')}>
                        {t.activate}
                      </Button>
                    )}
                  </Td>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {failed && !asking && (
        <p role="alert" className="m-0 text-body text-alpa">
          {failed}
        </p>
      )}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => !open && !busy && setAsking(null)}
        alert
        title={asking ? fill(t.suspendTitle, { name: asking.name, role: ROLE_LABELS[asking.role] }) : ''}
        description={asking ? fill(t.suspendBody, { name: asking.name }) : undefined}
        actions={
          <Button loading={busy} onClick={() => asking && void change(asking, 'suspended').then((ok) => ok && setAsking(null))}>
            {t.suspend}
          </Button>
        }
      >
        {failed && (
          <p role="alert" className="m-0 text-body text-alpa">
            {failed}
          </p>
        )}
      </Dialog>
    </>
  );
}
