import { Fragment } from 'react';
import type { Block, Inline, Release } from '@/lib/changelog';
import { releaseDate } from '@/lib/changelog';
import styles from './changelog.module.css';

const Parts = ({ parts }: { parts: Inline[] }) => (
  <>
    {parts.map((p, i) => (
      <Fragment key={i}>{p.bold ? <strong>{p.text}</strong> : p.text}</Fragment>
    ))}
  </>
);

function BlockView({ block }: { block: Block }) {
  if (block.kind === 'heading') return <h4 className={styles.sub}>{block.text}</h4>;
  if (block.kind === 'paragraph') {
    return (
      <p>
        <Parts parts={block.parts} />
      </p>
    );
  }
  return (
    <ul className={styles.list}>
      {block.items.map((item, i) => (
        <li key={i}>
          <Parts parts={item} />
        </li>
      ))}
    </ul>
  );
}

/** One release as text: the blocks become elements, never HTML. */
export function ReleaseNotes({ release, level = 2 }: { release: Release; level?: 2 | 3 }) {
  const Title = level === 2 ? 'h2' : 'h3';
  return (
    <article aria-label={release.title}>
      <Title className={styles.heading}>{release.title}</Title>
      <p className={styles.date}>{releaseDate(release.date)}</p>
      <div className={styles.body}>
        {release.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    </article>
  );
}
