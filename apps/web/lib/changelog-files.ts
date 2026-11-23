import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { newestFirst, parseRelease, type Release } from './changelog';

/**
 * The release notes shipped with this build (apps/web/changelog/*.md). Read once at module scope: the files never change
 * while the app runs, so this completes during prerender. Server-side only (node:fs). A file that does not parse is skipped.
 */
function loadReleases(): Release[] {
  const dir = path.join(process.cwd(), 'changelog');
  const releases: Release[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const release = parseRelease(name, readFileSync(path.join(dir, name), 'utf8'));
    if (release) releases.push(release);
  }
  return newestFirst(releases);
}

export const RELEASES: Release[] = loadReleases();
