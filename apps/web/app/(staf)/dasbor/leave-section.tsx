'use client';

import { LeaveRequest, type LeaveRequestList } from '@absah/contracts';
import { Avatar, BoardSection, Button, Chip, Dialog, ListCardList, ListCardRow, messages } from '@absah/ui';
import { Paperclip, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { dateRangeLabel, LEAVE_KIND_LABELS } from '@/lib/leave';
import type { Section } from '@/lib/use-section';
import { useWorkspace } from '@/lib/workspace';

const t = messages.board;
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');

/**
 * "Izin menunggu persetujuan": Tolak and Setujui per row, each asking first and saying what it changes. One Idempotency-Key per
 * (request, answer), kept after a lost reply and dropped once the API answered. Only this part and the summary reload afterwards.
 */
export function LeaveSection({ section, onDecided }: { section: Section<LeaveRequestList>; onDecided: () => void }) {
  const { schoolId } = useWorkspace();
  const [asking, setAsking] = useState<{ leave: LeaveRequest; approve: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  async function decide() {
    if (!asking) return;
    const { leave, approve } = asking;
    const slot = `${leave.id}:${approve}`;
    const idempotencyKey = keys.current.get(slot) ?? newIdempotencyKey();
    keys.current.set(slot, idempotencyKey);
    setBusy(true);
    setFailed(null);
    try {
      await api(`/leave-requests/${leave.id}/decide`, LeaveRequest, { method: 'POST', body: { approve }, schoolId, idempotencyKey });
      keys.current.delete(slot);
      setDone(fill(t.decided, { name: leave.student.name, result: approve ? t.approved : t.rejected }));
      setAsking(null);
      section.reload();
      onDecided();
    } catch (err) {
      if (err instanceof ApiError) keys.current.delete(slot);
      setFailed(err instanceof ApiError ? err.message : t.decideFailed);
    } finally {
      setBusy(false);
    }
  }

  const items = section.data?.items ?? [];
  const range = asking ? dateRangeLabel(asking.leave.startsOn, asking.leave.endsOn) : '';
  const name = asking?.leave.student.name ?? '';
  return (
    <BoardSection
      title={t.leaveTitle}
      subtitle={t.leaveAside}
      {...(items.length > 0 ? { count: fill(t.leaveCount, { n: String(items.length) }) } : {})}
      state={section.state}
      emptyText={t.leaveEmpty}
      onRetry={section.reload}
    >
      {done && (
        <p role="status" className="m-0 text-small text-papan">
          {done}
        </p>
      )}
      <ListCardList label={t.leaveTitle}>
        {items.map((l) => (
          <ListCardRow
            key={l.id}
            lead={<Avatar name={l.student.name} seed={l.student.enrollmentId} size={38} />}
            title={l.student.name}
            tags={
              <>
                <span className="text-small text-tinta-muted">{l.student.className}</span>
                <Chip tone={l.kind === 'sakit' ? 'sakit' : 'izin'}>{LEAVE_KIND_LABELS[l.kind]}</Chip>
              </>
            }
            detail={`${dateRangeLabel(l.startsOn, l.endsOn)} · ${l.reason}`}
            below={
              <span>
                {l.hasAttachment ? (
                  <Chip tone="papan" icon={Paperclip}>
                    {t.attachment}
                  </Chip>
                ) : (
                  <Chip tone="stabilo" icon={TriangleAlert}>
                    {t.noAttachment}
                  </Chip>
                )}
              </span>
            }
            end={
              <>
                <Button variant="outline" size="40" aria-label={`${t.reject} izin ${l.student.name}`} onClick={() => { setFailed(null); setAsking({ leave: l, approve: false }); }}>
                  {t.reject}
                </Button>
                <Button size="40" aria-label={`${t.approve} izin ${l.student.name}`} onClick={() => { setFailed(null); setAsking({ leave: l, approve: true }); }}>
                  {t.approve}
                </Button>
              </>
            }
          />
        ))}
      </ListCardList>
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => !open && !busy && setAsking(null)}
        alert
        title={fill(asking?.approve ? t.approveTitle : t.rejectTitle, { name })}
        description={fill(asking?.approve ? t.approveBody : t.rejectBody, { name, range, kind: asking ? LEAVE_KIND_LABELS[asking.leave.kind] : '' })}
        actions={
          <Button loading={busy} onClick={() => void decide()}>
            {asking?.approve ? t.approve : t.reject}
          </Button>
        }
      >
        {failed && (
          <p role="alert" className="m-0 text-body text-alpa">
            {failed}
          </p>
        )}
      </Dialog>
    </BoardSection>
  );
}
