import { expect, test } from '@playwright/test';
import path from 'node:path';
import { API_PORT, DAPODIK_FIXTURES } from './env';
import { createSchool, fakeGatewayPaid, issueInvoice, onboardAdmin } from './helpers';

const thisMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date());

test('Tagihan Absah: terbit, admin bayar lewat VA, webhook penyedia melunasi sekali', async ({ page }) => {
  test.slow(); // onboarding, import, the worker opening the VA and the payment job (every minute)
  const { schoolId, inviteUrl, email } = createSchool('SMP Tagihan E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  issueInvoice(schoolId, thisMonth());
  const list = await page.request.get('/api/v1/billing/invoices', { headers: { 'x-school-id': schoolId } });
  const [invoice] = ((await list.json()) as { items: { id: string; total: number }[] }).items;
  expect(invoice?.total).toBeGreaterThan(0);
  const total = `Rp${new Intl.NumberFormat('id-ID').format(invoice?.total ?? 0)}`;

  await page.goto('/tagihan');
  const row = page.getByRole('row').filter({ hasText: total });
  await expect(row).toContainText('Belum dibayar');
  await row.getByRole('link').click();
  await expect(page.getByRole('heading', { name: /^Tagihan / })).toBeVisible();

  // The worker opens the VA at the (fake) gateway; the page polls until the number is there.
  await page.getByRole('button', { name: 'Bayar lewat Virtual Account' }).click();
  await expect(page.getByTestId('va-number')).toHaveText(/^988\d /, { timeout: 30_000 });

  const payments = await page.request.get(`/api/v1/billing/invoices/${invoice?.id}/payments`, { headers: { 'x-school-id': schoolId } });
  const [payment] = ((await payments.json()) as { items: { id: string; amount: number }[] }).items;
  const paid = fakeGatewayPaid(payment?.id ?? '', payment?.amount ?? 0);
  const webhookUrl = `http://localhost:${API_PORT}/api/v1/webhooks/payments`;
  for (let i = 0; i < 2; i += 1) expect((await page.request.post(webhookUrl, { data: paid.body, headers: paid.headers })).status()).toBe(200);

  // bil.apply-payments runs every minute; the page checks every 10 s.
  await expect(page.getByText(/^Lunas pada /)).toBeVisible({ timeout: 90_000 });
  const after = await page.request.get(`/api/v1/billing/invoices/${invoice?.id}/payments`, { headers: { 'x-school-id': schoolId } });
  const items = ((await after.json()) as { items: { status: string }[] }).items;
  expect(items.filter((p) => p.status === 'paid')).toHaveLength(1);
});
