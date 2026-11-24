// Renders the static design boards to design/reference/<nama>.png at the size in canvas.json.
//   node design/render.mjs            all static boards
//   node design/render.mjs Sistem-UI  one board
// Static boards are plain HTML with inline styles once the <x-dc> wrapper, <helmet> and scripts are removed.
// Templated boards (Main, Guru-isi-sesi, Setup-jenjang, Data-*) hold {{holes}} and sc-if/sc-for tags that only the
// design canvas can render. They are read as behaviour pseudo-code and are not rendered here.
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const boardsDir = join(here, 'boards');
const outDir = join(here, 'reference');
const tmpDir = join(here, '.render-tmp');

export const STATIC_BOARDS = ['Alur-presensi', 'Sistem-UI', 'Riset-UI', 'Kios-pulang', 'Lapor-tppk', 'Ortu-portal-sd', 'Siswa-pkl', 'Auth-alur', 'Motion-UI'];

const canvas = JSON.parse(readFileSync(join(boardsDir, 'canvas.json'), 'utf8'));

/** Drops the canvas wrapper so the board is ordinary HTML. The Google Fonts <link> inside <helmet> is kept. */
export function unwrap(html) {
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(html)?.[1] ?? '';
  return html
    .replace(/<helmet>[\s\S]*?<\/helmet>/, '')
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/<\/?x-dc>/g, '')
    .replace('</head>', `${helmet}</head>`);
}

const wanted = process.argv.slice(2);
const names = wanted.length ? wanted : STATIC_BOARDS;
for (const n of names) {
  if (!STATIC_BOARDS.includes(n)) throw new Error(`${n} is not a static board (${STATIC_BOARDS.join(', ')})`);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const name of names) {
    const board = canvas.boards[`${name}.dc.html`];
    if (!board) throw new Error(`${name} is missing in canvas.json`);
    const file = join(tmpDir, `${name}.html`);
    writeFileSync(file, unwrap(readFileSync(join(boardsDir, `${name}.dc.html`), 'utf8')));
    const page = await browser.newPage({ viewport: { width: board.w, height: board.h } });
    // Fonts come from Google Fonts; without signal the page still renders with the system fallback.
    await page.goto(`file://${file}`, { waitUntil: 'load', timeout: 20_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready).catch(() => undefined);
    // fullPage: the board's own content height is the truth (canvas.json h is the frame on the canvas).
    await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
    await page.close();
    console.log(`${name}.png  ${board.w} x ${board.h}`);
  }
} finally {
  await browser.close();
  rmSync(tmpDir, { recursive: true, force: true });
}
