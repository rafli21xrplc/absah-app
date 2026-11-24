/**
 * In-app changelog (PLT-08). One Markdown file per release in apps/web/changelog/<date>-<slug>.md:
 *
 *   ---
 *   title: Yang baru bulan ini
 *   date: 2026-11-23
 *   ---
 *   ## Heading
 *   A paragraph with **bold** words.
 *   - a list item
 *
 * Only that small subset is understood, and it is turned into data (never HTML), so a release note cannot inject markup.
 */

export interface Inline {
  text: string;
  bold: boolean;
}
export type Block = { kind: 'heading'; text: string } | { kind: 'paragraph'; parts: Inline[] } | { kind: 'list'; items: Inline[][] };

export interface Release {
  /** The file name without .md; sorts by date because it starts with it. */
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  blocks: Block[];
}

/** "a **b** c" -> three parts. An unclosed ** stays as written. */
export function parseInline(text: string): Inline[] {
  const pieces = text.split('**');
  if (pieces.length % 2 === 0) return text ? [{ text, bold: false }] : [];
  return pieces.flatMap((piece, i) => (piece ? [{ text: piece, bold: i % 2 === 1 }] : []));
}

function parseBlocks(lines: readonly string[]): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', parts: parseInline(paragraph.join(' ')) });
    if (list.length > 0) blocks.push({ kind: 'list', items: list });
    paragraph = [];
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) flush();
    else if (line.startsWith('## ')) {
      flush();
      blocks.push({ kind: 'heading', text: line.slice(3).trim() });
    } else if (line.startsWith('- ')) {
      if (paragraph.length > 0) flush();
      list.push(parseInline(line.slice(2).trim()));
    } else {
      if (list.length > 0) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** A release from its file name and text, or null when the front matter lacks a title or a YYYY-MM-DD date. */
export function parseRelease(fileName: string, source: string): Release | null {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  const meta = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const at = line.indexOf(':');
    if (at > 0) meta.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  const title = meta.get('title');
  const date = meta.get('date');
  if (!title || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { id: fileName.replace(/\.md$/, ''), title, date, blocks: parseBlocks(lines.slice(end + 1)) };
}

/** Newest first. */
export const newestFirst = (releases: readonly Release[]): Release[] => [...releases].sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));

/**
 * What to show someone who last saw `seenUpTo`: the releases newer than it. A person who has seen nothing yet (or whose
 * last release no longer exists) gets only the newest one, not the whole history.
 */
export function unseenReleases(releases: readonly Release[], seenUpTo: string | null): Release[] {
  const sorted = newestFirst(releases);
  const at = seenUpTo === null ? -1 : sorted.findIndex((r) => r.id === seenUpTo);
  return at < 0 ? sorted.slice(0, 1) : sorted.slice(0, at);
}

export const seenKey = (userId: string) => `absah.changelog.${userId}`;

export function readSeen(userId: string): string | null {
  try {
    return localStorage.getItem(seenKey(userId));
  } catch {
    return null;
  }
}

export function writeSeen(userId: string, releaseId: string): void {
  try {
    localStorage.setItem(seenKey(userId), releaseId);
  } catch {
    // private mode: the notice may show again next time
  }
}

export const releaseDate = (date: string): string => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
