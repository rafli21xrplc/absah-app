import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The sign-in screen against a pretend server (page.route): every state of the Auth-masuk board without a database. The real
// sign-in with a real account is covered by every other spec through helpers.acceptInvite.
const SCHOOL = { id: '0196a000-0000-7000-8000-0000000000aa', name: 'SMA Absah Uji', level: 'sma', isMadrasah: false, timezone: 'Asia/Jakarta', roles: ['guru'] };
const USER = { id: '0196a000-0000-7000-8000-0000000000bb', name: 'Pak Hendra', email: 'hendra@absahuji.sch.id', phoneNumber: null, twoFactorEnabled: false };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => ({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });

async function meContext(page: Page) {
  await page.route('**/api/v1/me/context', (route) =>
    route.fulfill(json({ user: USER, schools: [SCHOOL], active: route.request().headers()['x-school-id'] ? { schoolId: SCHOOL.id, roles: ['guru'], capabilities: {} } : null })),
  );
}

async function fillStaff(page: Page, email = 'hendra@absahuji.sch.id', password = 'contoh-sandi-1') {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi').fill(password);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('salah isi: pesan di kolom, fokus ke kolom pertama yang salah, tidak ada permintaan ke server', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/auth/**', (route) => (calls++, route.abort()));
  await page.goto('/masuk');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByText('Isi email Anda.')).toBeVisible();
  await expect(page.getByText('Isi kata sandi Anda.')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeFocused();
  await page.getByLabel('Email').fill('hendra@absah');
  await page.getByLabel('Kata sandi').fill('x');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Email belum lengkap. Contoh: nama@sekolah.sch.id')).toBeVisible();
  expect(calls).toBe(0);
});

test('berhasil: centang, langkah mengikuti pemuatan sungguhan, lalu pindah ke beranda', async ({ page }) => {
  await meContext(page);
  let body: Record<string, unknown> = {};
  await page.route('**/api/auth/sign-in/email', (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill(json({ user: { name: 'Pak Hendra' }, token: 't' }));
  });
  await page.goto('/masuk?lanjut=%2Fsiswa');
  await fillStaff(page);
  await page.keyboard.press('Enter');
  expect(body).toMatchObject({ email: 'hendra@absahuji.sch.id', rememberMe: false });
  await expect(page.getByRole('heading', { name: 'Berhasil masuk' })).toBeVisible();
  await expect(page.getByText('Selamat datang, Pak Hendra.')).toBeVisible();
  await page.waitForURL((url) => url.pathname === '/siswa');
});

test('kata sandi salah: banner tanpa menyebut mana yang salah, fokus pindah ke banner, kolom tetap terisi', async ({ page }) => {
  await page.route('**/api/auth/sign-in/email', (route) => route.fulfill(json({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' }, 401)));
  await page.goto('/masuk');
  await fillStaff(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  const banner = page.getByRole('alert').filter({ hasText: 'Email atau kata sandi belum cocok' });
  await expect(banner).toBeVisible();
  await expect(banner).not.toContainText(/salah satu|email salah|kata sandi salah/i);
  await expect(page.locator('[tabindex="-1"]').filter({ has: banner })).toBeFocused();
  await expect(page.getByLabel('Email')).toHaveValue('hendra@absahuji.sch.id');
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeEnabled();
});

test('terkunci: banner dengan jam buka, tombol nonaktif dengan alasan di tombolnya', async ({ page }) => {
  await page.route('**/api/auth/sign-in/email', (route) => route.fulfill(json({ message: 'Too many requests' }, 429, { 'x-retry-after': '600' })));
  await page.goto('/masuk');
  await fillStaff(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Akun dikunci sementara' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /Coba lagi pukul \d{2}\.\d{2}/ })).toBeVisible();
  const button = page.getByRole('button', { name: /^Masuk \(dikunci sampai \d{2}\.\d{2}\)$/ });
  await expect(button).toBeDisabled();
});

test('tanpa sinyal: banner kuning dan tombol "Masuk (perlu sinyal)"', async ({ page, context }) => {
  await page.goto('/masuk');
  await context.setOffline(true);
  await expect(page.getByText('Tidak ada sinyal.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Masuk (perlu sinyal)' })).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeEnabled();
});

test('admin dengan dua langkah: kode enam kotak masuk sendiri; kode salah mengosongkan kotak', async ({ page }) => {
  await meContext(page);
  await page.route('**/api/auth/sign-in/email', (route) => route.fulfill(json({ twoFactorRedirect: true })));
  let tries = 0;
  await page.route('**/api/auth/two-factor/verify-totp', (route) => (tries++ === 0 ? route.fulfill(json({ message: 'bad' }, 401)) : route.fulfill(json({ token: 't' }))));
  await page.goto('/masuk?lanjut=%2Fsiswa');
  await fillStaff(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Masukkan kode dari aplikasi' })).toBeVisible();
  const code = page.getByRole('textbox', { name: 'Kode dari aplikasi autentikator' });
  await expect(code).toBeFocused();
  await code.fill('123456');
  await expect(page.getByText('Kode tidak cocok. Periksa jam di HP lalu coba lagi.')).toBeVisible();
  await expect(code).toHaveValue('');
  await code.fill('654321');
  await page.waitForURL((url) => url.pathname === '/siswa');
});

test('orang tua: nomor, kode enam angka masuk sendiri, kirim ulang tertahan hitung mundur', async ({ page }) => {
  await meContext(page);
  let sentTo = '';
  await page.route('**/api/auth/phone-number/send-otp', (route) => {
    sentTo = (route.request().postDataJSON() as { phoneNumber: string }).phoneNumber;
    return route.fulfill(json({ message: 'ok' }));
  });
  let tries = 0;
  await page.route('**/api/auth/phone-number/verify', (route) => (tries++ === 0 ? route.fulfill(json({ message: 'bad' }, 400)) : route.fulfill(json({ token: 't' }))));
  await page.goto('/masuk?lanjut=%2Fsiswa');
  await page.getByRole('tab', { name: 'Orang tua' }).click();
  await page.getByLabel('Nomor WhatsApp').fill('0812 3456 7890');
  await page.getByRole('button', { name: 'Kirim kode' }).click();
  expect(sentTo).toBe('+6281234567890');
  await expect(page.getByRole('heading', { name: 'Masukkan kode 6 angka' })).toBeVisible();
  await expect(page.getByText('+62 812 ••• ••90')).toBeVisible();
  await expect(page.getByText(/Kirim ulang kode dalam/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kirim ulang kode' })).toHaveCount(0);
  const code = page.getByRole('textbox', { name: 'Kode dari WhatsApp' });
  await code.fill('111111');
  await expect(page.getByText(/Kode salah atau sudah kedaluwarsa/)).toBeVisible();
  await expect(code).toHaveValue('');
  await code.fill('222222');
  await page.waitForURL((url) => url.pathname === '/siswa');
});

test('siswa: penjelasan masuk lewat tautan sekolah, tanpa formulir', async ({ page }) => {
  await page.goto('/masuk');
  await page.getByRole('tab', { name: 'Siswa' }).click();
  await expect(page.getByText('Siswa masuk lewat tautan dari sekolah')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
});

test('alamat WhatsApp lama membuka tab Orang tua', async ({ page }) => {
  await page.goto('/masuk/hp?lanjut=%2Fportal');
  await expect(page.getByRole('tab', { name: 'Orang tua' })).toHaveAttribute('aria-selected', 'true');
});

test('layar lebar: panel di samping formulir menyebut bagian Absah yang terhubung, bergerak, dan bisa dijeda', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'panel hanya ada di layar lebar');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/masuk');
  const panel = page.getByRole('complementary', { name: 'Tentang Absah' });
  await expect(panel.getByRole('heading', { name: 'Satu sekolah, semua tercatat.' })).toBeVisible();
  await expect(panel.getByRole('list', { name: 'Yang terhubung di Absah' }).getByRole('listitem')).toHaveCount(8);
  // The form comes first (left), the panel second (right).
  const form = await page.getByRole('main').boundingBox();
  const side = await panel.boundingBox();
  expect((form?.x ?? 0) < (side?.x ?? 0)).toBe(true);
  const states = () =>
    page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => ((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest?.('aside'))
        .filter((a) => a.effect?.getTiming().iterations === Infinity)
        .map((a) => a.playState),
    );
  await expect.poll(async () => (await states()).includes('running')).toBe(true);
  await page.getByRole('button', { name: 'Jeda animasi panel' }).click();
  await expect.poll(async () => (await states()).every((s) => s === 'paused')).toBe(true);
  await page.getByRole('button', { name: 'Putar animasi panel' }).click();
  await expect.poll(async () => (await states()).includes('running')).toBe(true);
  if (process.env.SHOTS) {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${process.env.SHOTS}/masuk-${info.project.name}.png` });
  }
});

test('dengan gerak dikurangi, panel diam dan tombol jeda tidak ada', async ({ page, isMobile }) => {
  test.skip(isMobile, 'panel hanya ada di layar lebar');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/masuk');
  await expect(page.getByRole('list', { name: 'Yang terhubung di Absah' }).getByRole('listitem')).toHaveCount(8);
  const moving = await page.evaluate(() => document.getAnimations().filter((a) => ((a.effect as KeyframeEffect | null)?.target as Element | null)?.closest?.('aside')).length);
  expect(moving).toBe(0);
  await expect(page.getByRole('button', { name: 'Jeda animasi panel' })).toBeHidden();
});

test('tombol tema di halaman masuk mengganti terang dan gelap', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/masuk');
  await page.getByRole('button', { name: 'Ganti ke tema gelap' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/masuk-gelap-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Ganti ke tema terang' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('HP: formulir saja, tanpa panel', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'khusus HP');
  await page.goto('/masuk');
  await expect(page.getByRole('complementary', { name: 'Tentang Absah' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Masuk ke Absah' })).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/masuk-${info.project.name}.png` });
});

for (const scheme of ['light', 'dark'] as const) {
  test(`keadaan masuk tanpa pelanggaran aksesibilitas (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const axe = async (label: string) => {
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(violations.map((v) => `${label}: ${v.id} ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    };
    await page.route('**/api/auth/sign-in/email', (route) => route.fulfill(json({ code: 'X' }, 401)));
    await page.route('**/api/auth/phone-number/send-otp', (route) => route.fulfill(json({ message: 'ok' })));
    await page.goto('/masuk');
    await axe('awal');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByText('Isi email Anda.')).toBeVisible();
    await axe('salah isi');
    await fillStaff(page);
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'belum cocok' })).toBeVisible();
    await axe('kata sandi salah');
    await page.getByRole('tab', { name: 'Orang tua' }).click();
    await axe('orang tua');
    await page.getByLabel('Nomor WhatsApp').fill('0812 3456 7890');
    await page.getByRole('button', { name: 'Kirim kode' }).click();
    await expect(page.getByRole('heading', { name: 'Masukkan kode 6 angka' })).toBeVisible();
    await axe('kode');
  });
}
