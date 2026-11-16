import type { AttendanceStatus } from '@absah/contracts';
import { STATUS_LABELS } from '@/lib/attendance';
import styles from './portal.module.css';

export function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  return <span className={`${styles.status} ${status ? (styles[`status${status}`] ?? '') : ''}`}>{status ? STATUS_LABELS[status] : 'Belum tercatat'}</span>;
}
