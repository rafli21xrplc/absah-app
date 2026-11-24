// First-load JavaScript per page, from the build itself: every prerendered page lists the scripts the browser downloads on first
// load. The sum of their gzip sizes is checked against a budget, so a page cannot quietly grow (a heavy library imported in a
// shared component grows every page at once).
//   node scripts/bundle-budget.mjs          check against budget.json, exit 1 when over
//   node scripts/bundle-budget.mjs --table  print every page, largest first
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '.next');
const budget = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'budget.json'), 'utf8'));

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.html') ? [path] : [];
  });
}

const gzipCache = new Map();
function gzipKb(url) {
  const file = join(root, url.replace(/^\/_next\//, '').split('?')[0]);
  if (!gzipCache.has(file)) gzipCache.set(file, gzipSync(readFileSync(file)).length / 1024);
  return gzipCache.get(file);
}

const appDir = join(root, 'server', 'app');
const pages = walk(appDir)
  .filter((f) => !/(_not-found|_global-error)/.test(f))
  .map((file) => {
    const html = readFileSync(file, 'utf8');
    const scripts = new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js[^"]*)"/g)].map((m) => m[1]));
    const kb = [...scripts].reduce((sum, s) => sum + gzipKb(s), 0);
    return { route: '/' + relative(appDir, file).replace(/\.html$/, '').replace(/^index$/, ''), kb };
  })
  .sort((a, b) => b.kb - a.kb);

if (pages.length < 10) {
  console.error(`Only ${pages.length} prerendered pages found in ${appDir}. Did the build run?`);
  process.exit(2);
}
if (process.argv.includes('--table')) for (const p of pages) console.log(`${p.kb.toFixed(1).padStart(7)} kB  ${p.route}`);

const over = pages.filter((p) => p.kb > (budget.routes[p.route] ?? budget.defaultKb));
for (const p of over) console.error(`OVER BUDGET  ${p.route}: ${p.kb.toFixed(1)} kB gzip, limit ${budget.routes[p.route] ?? budget.defaultKb} kB`);
console.log(`${pages.length} pages, largest ${pages[0].route} at ${pages[0].kb.toFixed(1)} kB gzip, default limit ${budget.defaultKb} kB, ${over.length} over.`);
process.exit(over.length > 0 ? 1 : 0);
