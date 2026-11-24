import { messages } from '../../messages/id';
import { cx } from '../cx';

const SHAPE = { line: 'h-3 rounded-full', circle: 'size-10 rounded-full', block: 'h-8 w-20 rounded-md' } as const;

/** A grey placeholder. Decorative: a group of them is announced once by SkeletonRows. */
export function Skeleton({ shape = 'line', className }: { shape?: keyof typeof SHAPE; className?: string }) {
  return <div aria-hidden className={cx('animate-pulse bg-garis', SHAPE[shape], className)} />;
}

/** The "memuat" state of a list: rows shaped like ListRow, announced once as "Sedang memuat". */
export function SkeletonRows({ count = 3, label = messages.skeleton.label }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 rounded-md border border-garis bg-kapur-raised px-3 py-2">
          <Skeleton shape="circle" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="w-2/3" />
            <Skeleton className="w-1/3" />
          </div>
          <Skeleton shape="block" />
        </div>
      ))}
    </div>
  );
}
