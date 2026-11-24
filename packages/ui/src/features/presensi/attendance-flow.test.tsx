// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { AttendanceFlow, type AttendanceFlowProps, type FlowStudent, type SendResult } from './attendance-flow';
import type { Mark } from './reducer';

const NAMES = ['Adinda Saraswati', 'Ahmad Fauzan', 'Anisa Rahmawati', 'Bagas Wicaksono', 'Bayu Firmansyah', 'Citra Maharani', 'Daffa Alfarizi', 'Eka Prasetyo', 'Farah Nabila', 'Gilang Ramadhan', 'Hana Safitri', 'Ilham Kurniawan', 'Intan Permata', 'Joko Susilo', 'Kevin Santoso', 'Laila Fitriani', 'Muhammad Iqbal', 'Nabila Zahra', 'Oktaviani Dewi', 'Putri Ayu Lestari', 'Rafi Hidayat', 'Rizky Maulana', 'Sekar Ayuningtyas', 'Tegar Pamungkas', 'Yusuf Habibie'];

const roster = (preset: Record<number, { mark: Mark; fixed?: boolean; detail?: string }> = {}): FlowStudent[] =>
  NAMES.map((name, i) => ({ id: `s${i + 1}`, name, mark: preset[i + 1]?.mark ?? '?', fixed: preset[i + 1]?.fixed ?? false, ...(preset[i + 1]?.detail ? { detail: preset[i + 1]?.detail } : {}) }));

const sent: SendResult = { kind: 'sent' };

function setup(over: Partial<AttendanceFlowProps> = {}) {
  const onSubmit = vi.fn<AttendanceFlowProps['onSubmit']>(() => Promise.resolve(sent));
  const user = userEvent.setup();
  const utils = render(
    <AttendanceFlow
      title="X-2 · Matematika"
      subtitle="Jam ke-3 · 08.30–09.15"
      dateLabel="Senin, 25 Januari"
      shortTitle="X-2"
      students={roster()}
      backHref="/hari-ini"
      onSubmit={onSubmit}
      {...over}
    />,
  );
  return { user, onSubmit, ...utils };
}

const row = (name: string, word: string) => screen.getByRole('button', { name: `${name}: ${word}. Ketuk untuk mengubah.` });

async function pick(user: ReturnType<typeof userEvent.setup>, name: string, currentWord: string, choice: string) {
  await user.click(row(name, currentWord));
  const sheet = await screen.findByRole('dialog', { name: `Pilih kehadiran untuk ${name}` });
  await user.click(within(sheet).getByRole('button', { name: new RegExp(`^${choice}:`) }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

async function toSend(over: Partial<AttendanceFlowProps> = {}) {
  const ctx = setup(over);
  await ctx.user.click(screen.getByRole('button', { name: /Semua hadir/ }));
  await pick(ctx.user, 'Bayu Firmansyah', 'Hadir', 'Telat');
  await pick(ctx.user, 'Rizky Maulana', 'Hadir', 'Izin');
  await pick(ctx.user, 'Putri Ayu Lestari', 'Hadir', 'Alpa');
  await ctx.user.click(screen.getByRole('button', { name: /^(Periksa dan kirim|Simpan presensi di HP)$/ }));
  return ctx;
}

describe('step 2: opened, everyone "Belum diisi"', () => {
  it('shows 25 students all "Belum diisi", the progress, the filters and the footer', async () => {
    const { container } = setup();
    expect(screen.getByRole('heading', { level: 1, name: 'X-2 · Matematika' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /: Belum diisi\. Ketuk untuk mengubah\.$/ })).toHaveLength(25);
    const bar = screen.getByRole('progressbar', { name: 'Siswa yang sudah diisi' });
    expect(bar.getAttribute('aria-valuetext')).toBe('0 dari 25 siswa sudah diisi');
    expect(screen.getByRole('button', { name: 'Semua 25' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Belum 25' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tidak hadir 0' })).toBeTruthy();
    expect(screen.getByText('Hadir 0')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('the main button shows the unfilled and there is no way to send yet', async () => {
    const { user } = setup();
    expect(screen.queryByRole('button', { name: 'Periksa dan kirim' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Lihat 25 siswa yang belum diisi' }));
    expect(screen.getByRole('button', { name: 'Belum 25' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('the Semua hadir button says how many it will mark', () => {
    setup();
    expect(screen.getByRole('button', { name: /Semua hadir/ }).textContent).toContain('Tandai 25 siswa yang belum diisi sebagai Hadir');
  });

  it('a student filled by an official source keeps the mark and says where it came from', () => {
    setup({ students: roster({ 22: { mark: 'I', fixed: true, detail: 'Izin disetujui' }, 3: { mark: 'H', detail: 'Gerbang' } }) });
    expect(screen.getByText('Izin disetujui')).toBeTruthy();
    expect(screen.getByText('Gerbang')).toBeTruthy();
    // The fixed one is a plain row: no button to change it.
    expect(screen.queryByRole('button', { name: /^Rizky Maulana:/ })).toBeNull();
    expect(screen.getByText('Rizky Maulana')).toBeTruthy();
    // The gate one can be changed, and its source is read after the name.
    expect(row('Anisa Rahmawati', 'Hadir').getAttribute('aria-describedby')).not.toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('2 dari 25 siswa sudah diisi');
  });
});

describe('step 3: Semua hadir', () => {
  it('marks the rest Hadir, says so in a toast with Urungkan, and offers Periksa dan kirim', async () => {
    const { user, container } = setup();
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    expect(screen.getAllByRole('button', { name: /: Hadir\. Ketuk untuk mengubah\.$/ })).toHaveLength(25);
    expect(await screen.findByText('25 siswa ditandai Hadir. Sekarang ketuk nama yang tidak hadir.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Urungkan' })).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Semua 25 siswa sudah diisi');
    expect(screen.getByRole('button', { name: 'Periksa dan kirim' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Semua hadir|Sisanya hadir/ })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('Urungkan puts everything back to "Belum diisi"', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    await user.click(await screen.findByRole('button', { name: 'Urungkan' }));
    expect(screen.getAllByRole('button', { name: /: Belum diisi\. Ketuk/ })).toHaveLength(25);
    expect(screen.getByRole('button', { name: /Semua hadir/ })).toBeTruthy();
  });

  it('after some are filled it is called "Sisanya hadir" and leaves them alone', async () => {
    const { user } = setup();
    await pick(user, 'Ahmad Fauzan', 'Belum diisi', 'Alpa');
    await pick(user, 'Bayu Firmansyah', 'Belum diisi', 'Telat');
    await user.click(screen.getByRole('button', { name: /Sisanya hadir/ }));
    expect(row('Ahmad Fauzan', 'Alpa')).toBeTruthy();
    expect(row('Bayu Firmansyah', 'Telat')).toBeTruthy();
    expect(await screen.findByText('23 siswa ditandai Hadir. Sekarang ketuk nama yang tidak hadir.')).toBeTruthy();
  });

  it('is hidden while the Tidak hadir filter is on', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Tidak hadir 0/ }));
    expect(screen.queryByRole('button', { name: /Semua hadir/ })).toBeNull();
  });

  it('a choice made after it removes the toast, so Urungkan cannot undo the choice by accident', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    await screen.findByRole('button', { name: 'Urungkan' });
    await pick(user, 'Ahmad Fauzan', 'Hadir', 'Alpa');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Urungkan' })).toBeNull());
    expect(row('Ahmad Fauzan', 'Alpa')).toBeTruthy();
  });
});

describe('step 4: choose a reason in the sheet', () => {
  it('names the sheet for the student, explains the five choices in words, marks the current one', async () => {
    const { user, container } = setup();
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    await user.click(row('Gilang Ramadhan', 'Hadir'));
    const sheet = await screen.findByRole('dialog', { name: 'Pilih kehadiran untuk Gilang Ramadhan' });
    const names = within(sheet)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual([
      'Hadir: Ada di kelas',
      'Telat: Datang setelah pelajaran dimulai',
      'Izin: Tidak hadir, ada surat atau kabar dari orang tua',
      'Sakit: Tidak hadir karena sakit',
      'Alpa: Tidak hadir tanpa kabar',
      'Batal',
    ]);
    expect(within(sheet).getByRole('button', { name: /^Hadir:/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(sheet).getByText('Dipilih')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  for (const [choice, word] of [['Telat', 'Telat'], ['Izin', 'Izin'], ['Sakit', 'Sakit'], ['Alpa', 'Alpa']] as const) {
    it(`one tap on ${choice} chooses it and closes the sheet`, async () => {
      const { user } = setup();
      await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
      await pick(user, 'Gilang Ramadhan', 'Hadir', choice);
      expect(row('Gilang Ramadhan', word)).toBeTruthy();
      expect(screen.getByRole('button', { name: `Tidak hadir 1` })).toBeTruthy();
    });
  }

  it('Batal closes the sheet and changes nothing, and focus goes back to the row', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    const opener = row('Gilang Ramadhan', 'Hadir');
    await user.click(opener);
    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(row('Gilang Ramadhan', 'Hadir')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('the filters never reorder the students', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    await pick(user, 'Yusuf Habibie', 'Hadir', 'Sakit');
    await pick(user, 'Adinda Saraswati', 'Hadir', 'Alpa');
    await user.click(screen.getByRole('button', { name: 'Tidak hadir 2' }));
    const shown = screen.getAllByRole('button', { name: /Ketuk untuk mengubah/ }).map((b) => b.getAttribute('aria-label')?.split(':')[0]);
    expect(shown).toEqual(['Adinda Saraswati', 'Yusuf Habibie']);
  });

  it('the filter lists say so when empty', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Tidak hadir 0' }));
    expect(screen.getByText('Belum ada siswa yang tidak hadir.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Semua 25' }));
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    await user.click(screen.getByRole('button', { name: 'Belum 0' }));
    expect(screen.getByText('Semua siswa sudah diisi.')).toBeTruthy();
  });
});

describe('step 5: check before sending', () => {
  async function toReview(over: Partial<AttendanceFlowProps> = {}) {
    const ctx = setup(over);
    await ctx.user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    await pick(ctx.user, 'Bayu Firmansyah', 'Hadir', 'Telat');
    await pick(ctx.user, 'Rizky Maulana', 'Hadir', 'Izin');
    await pick(ctx.user, 'Putri Ayu Lestari', 'Hadir', 'Alpa');
    await ctx.user.click(screen.getByRole('button', { name: 'Periksa dan kirim' }));
    const sheet = await screen.findByRole('dialog', { name: 'Periksa sebelum kirim' });
    return { ...ctx, sheet };
  }

  it('shows five counts in words, the absent with their status, and the impact sentence', async () => {
    const { sheet, container } = await toReview();
    const boxes = Array.from(sheet.querySelectorAll('.grid > div')).map((d) => d.textContent);
    expect(boxes).toEqual(['22Hadir', '1Telat', '1Izin', '0Sakit', '1Alpa']);
    expect(within(sheet).getByText('Yang tidak hadir (3)')).toBeTruthy();
    const list = within(sheet).getByRole('list');
    // In lesson order, not in the order they were tapped. (The first letter is the pill's decorative chip.)
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Bayu FirmansyahTTelat', 'Putri Ayu LestariAAlpa', 'Rizky MaulanaIIzin']);
    expect(within(sheet).getByText(/orang tua siswa yang Alpa diberi tahu lewat WhatsApp/)).toBeTruthy();
    expect(within(sheet).getByText(/Presensi masih bisa diubah sampai pukul 23.59 hari ini/)).toBeTruthy();
    // The absent pills carry no chevron: they are not buttons here.
    expect(within(list).queryByRole('button')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('says "Semua siswa hadir." when nobody is absent, and leaves out the WhatsApp sentence', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    await user.click(screen.getByRole('button', { name: 'Periksa dan kirim' }));
    const sheet = await screen.findByRole('dialog', { name: 'Periksa sebelum kirim' });
    expect(within(sheet).getByText('Semua siswa hadir.')).toBeTruthy();
    expect(within(sheet).queryByText(/WhatsApp/)).toBeNull();
    expect(within(sheet).getByText('Presensi masih bisa diubah sampai pukul 23.59 hari ini.')).toBeTruthy();
  });

  it('leaves out the WhatsApp sentence when notifications are off', async () => {
    const { sheet } = await toReview({ notifyParents: false });
    expect(within(sheet).queryByText(/WhatsApp/)).toBeNull();
  });

  it('asks for the topic only for a lesson, and sends it', async () => {
    const { user, sheet, onSubmit } = await toReview({ withTopic: true });
    await user.type(within(sheet).getByLabelText(/Topik hari ini/), 'Persamaan kuadrat');
    await user.click(within(sheet).getByRole('button', { name: 'Kirim presensi' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0].topic).toBe('Persamaan kuadrat');
  });

  it('does not put the cursor in the topic field when the sheet opens (no keyboard over the summary)', async () => {
    const { sheet } = await toReview({ withTopic: true });
    expect(document.activeElement).not.toBe(within(sheet).getByLabelText(/Topik hari ini/));
    expect(sheet.contains(document.activeElement)).toBe(true);
  });

  it('has no topic field for a daily session', async () => {
    const { sheet } = await toReview({ withTopic: false });
    expect(within(sheet).queryByLabelText(/Topik hari ini/)).toBeNull();
  });

  it('"Kembali dan periksa lagi" closes the sheet and keeps every answer', async () => {
    const { user, sheet } = await toReview();
    await user.click(within(sheet).getByRole('button', { name: 'Kembali dan periksa lagi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(row('Putri Ayu Lestari', 'Alpa')).toBeTruthy();
  });
});

describe('step 6: sending', () => {
  it('sends only the students who are not Hadir', async () => {
    const { user, onSubmit } = await toSend();
    await user.click(await screen.findByRole('button', { name: 'Kirim presensi' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      exceptions: [
        { id: 's5', status: 'T' },
        { id: 's20', status: 'A' },
        { id: 's22', status: 'I' },
      ],
      topic: '',
    });
  });

  it('then shows "Presensi X-2 terkirim" with the summary, the way on and "Ubah presensi ini"', async () => {
    const { user, container } = await toSend({ next: { label: 'X-3 · Fisika, 09.15', href: '/sesi/next' } });
    await user.click(await screen.findByRole('button', { name: 'Kirim presensi' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Presensi X-2 terkirim' })).toBeTruthy();
    expect(screen.getByText(/Hadir 22 · Telat 1 · Izin 1 · Sakit 0 · Alpa 1\./)).toBeTruthy();
    expect(screen.getByText(/Masih bisa diubah sampai pukul 23.59 hari ini\./)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lanjut ke X-3 · Fisika, 09.15' }).getAttribute('href')).toBe('/sesi/next');
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Ubah presensi ini' }));
    expect(row('Putri Ayu Lestari', 'Alpa')).toBeTruthy();
  });

  it('with no next session the way on is back to Hari ini', async () => {
    const { user } = await toSend({ next: null });
    await user.click(await screen.findByRole('button', { name: 'Kirim presensi' }));
    expect((await screen.findByRole('link', { name: 'Kembali ke Hari ini' })).getAttribute('href')).toBe('/hari-ini');
  });

  it('a failed send keeps the sheet and every answer, says the data is safe, and can be sent again', async () => {
    const onSubmit = vi.fn<AttendanceFlowProps['onSubmit']>().mockResolvedValueOnce({ kind: 'failed' }).mockResolvedValueOnce(sent);
    const { user } = await toSend({ onSubmit });
    await user.click(await screen.findByRole('button', { name: 'Kirim presensi' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Presensi belum terkirim');
    expect(alert.textContent).toContain('Data Anda aman');
    expect(screen.getByRole('dialog', { name: 'Periksa sebelum kirim' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Kirim presensi' }));
    expect(await screen.findByRole('heading', { name: 'Presensi X-2 terkirim' })).toBeTruthy();
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[1]?.[0]).toEqual(onSubmit.mock.calls[0]?.[0]);
  });

  it('shows the server message when the page gives one', async () => {
    const onSubmit = vi.fn<AttendanceFlowProps['onSubmit']>().mockResolvedValue({ kind: 'failed', message: 'Sesi sudah dikunci.' });
    const { user } = await toSend({ onSubmit });
    await user.click(await screen.findByRole('button', { name: 'Kirim presensi' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Sesi sudah dikunci.');
  });

  it('with no signal it is kept on the phone: the "Tersimpan di HP" screen shows "Menunggu · n" and the answers stay', async () => {
    const onSubmit = vi.fn<AttendanceFlowProps['onSubmit']>().mockResolvedValue({ kind: 'queued' });
    const { user, container } = await toSend({ onSubmit, waitingCount: 2 });
    await user.click(await screen.findByRole('button', { name: 'Kirim presensi' }));
    expect(await screen.findByRole('heading', { name: 'Presensi X-2 tersimpan di HP' })).toBeTruthy();
    expect(screen.getByText('Menunggu · 2')).toBeTruthy();
    expect(screen.getByText(/Dikirim otomatis saat sinyal kembali/)).toBeTruthy();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Ubah presensi ini' }));
    expect(row('Putri Ayu Lestari', 'Alpa')).toBeTruthy();
  });

  it('when the last waiting one went out, the saved screen becomes the sent screen', async () => {
    const onSubmit = vi.fn<AttendanceFlowProps['onSubmit']>().mockResolvedValue({ kind: 'queued' });
    const { user, rerender } = await toSend({ onSubmit, waitingCount: 1 });
    await user.click(await screen.findByRole('button', { name: 'Kirim presensi' }));
    await screen.findByRole('heading', { name: 'Presensi X-2 tersimpan di HP' });
    rerender(<AttendanceFlow title="X-2 · Matematika" subtitle="Jam ke-3 · 08.30–09.15" dateLabel="Senin, 25 Januari" shortTitle="X-2" students={roster()} backHref="/hari-ini" onSubmit={onSubmit} waitingCount={0} />);
    expect(await screen.findByRole('heading', { name: 'Presensi X-2 terkirim' })).toBeTruthy();
    expect(screen.queryByText(/^Menunggu/)).toBeNull();
  });
});

describe('U5: without signal, before sending', () => {
  it('the main button says "Simpan presensi di HP", the sheet says what will happen and its button "Simpan di HP"', async () => {
    const { user } = await toSend({ offline: true });
    expect(screen.queryByRole('button', { name: 'Kirim presensi' })).toBeNull();
    const sheet = screen.getByRole('dialog', { name: 'Periksa sebelum kirim' });
    expect(within(sheet).getByRole('button', { name: 'Simpan di HP' })).toBeTruthy();
    expect(sheet.textContent).toContain('Presensi disimpan di HP ini dan dikirim otomatis saat sinyal kembali.');
    expect(sheet.textContent).not.toContain('WhatsApp');
    await user.click(within(sheet).getByRole('button', { name: 'Kembali dan periksa lagi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Simpan presensi di HP' })).toBeTruthy();
  });

  it('with signal the words stay "Periksa dan kirim" and "Kirim presensi"', async () => {
    await toSend();
    expect(screen.getByRole('button', { name: 'Kirim presensi' })).toBeTruthy();
  });
});

describe('step 1 of the flow: help', () => {
  it('shows the two-step card on the first visit, and "Mengerti" closes it and tells the page to remember', async () => {
    const onHelpSeen = vi.fn();
    const { user, container } = setup({ showHelpFirst: true, onHelpSeen });
    const card = screen.getByRole('region', { name: 'Cara mengisi presensi' });
    expect(within(card).getByText('Mengisi presensi, 2 langkah')).toBeTruthy();
    expect(card.textContent).toContain('Ketuk Semua hadir. Semua siswa yang belum diisi menjadi Hadir.');
    expect(card.textContent).toContain('Ketuk nama siswa yang tidak hadir, lalu pilih alasannya: Telat, Izin, Sakit, atau Alpa.');
    await expectNoAxeViolations(container);
    await user.click(within(card).getByRole('button', { name: 'Mengerti' }));
    expect(screen.queryByRole('region', { name: 'Cara mengisi presensi' })).toBeNull();
    expect(onHelpSeen).toHaveBeenCalledOnce();
  });

  it('is not shown again by itself, and the Bantuan button in the header opens it', async () => {
    const { user } = setup({ showHelpFirst: false });
    expect(screen.queryByRole('region', { name: 'Cara mengisi presensi' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cara mengisi presensi' }));
    expect(screen.getByRole('region', { name: 'Cara mengisi presensi' })).toBeTruthy();
  });

  it('closes itself when Semua hadir is pressed', async () => {
    const { user } = setup({ showHelpFirst: true });
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    expect(screen.queryByRole('region', { name: 'Cara mengisi presensi' })).toBeNull();
  });
});

describe('a locked session and corrections', () => {
  it('read-only: plain rows, no Semua hadir, no sending, the note and its action are shown', () => {
    const { container } = setup({
      students: roster(Object.fromEntries(NAMES.map((_, i) => [i + 1, { mark: 'H' }]))),
      readOnly: true,
      readOnlyNote: <p>Sesi ini sudah dikunci.</p>,
    });
    expect(screen.getByText('Sesi ini sudah dikunci.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ketuk untuk mengubah/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Semua hadir|Periksa dan kirim|Lihat/ })).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
  });

  it('a correction asks for a reason and sends only what changed', async () => {
    const onSubmit = vi.fn<NonNullable<AttendanceFlowProps['correction']>['onSubmit']>(() => Promise.resolve(sent));
    const { user } = setup({
      students: roster(Object.fromEntries(NAMES.map((_, i) => [i + 1, { mark: 'H' }]))),
      correction: { onSubmit, onCancel: () => undefined },
    });
    const main = () => screen.getByRole('button', { name: /^Ajukan koreksi/ });
    expect(main().getAttribute('aria-disabled')).toBe('true');
    await pick(user, 'Bayu Firmansyah', 'Hadir', 'Sakit');
    expect(main().textContent).toBe('Ajukan koreksi (1 siswa)');
    await user.click(main());
    const sheet = await screen.findByRole('dialog', { name: 'Ajukan koreksi' });
    expect(within(sheet).getByRole('button', { name: /^Ajukan koreksi/ }).getAttribute('aria-disabled')).toBe('true');
    expect(within(sheet).getByText('Tulis alasan koreksi dulu')).toBeTruthy();
    await user.type(within(sheet).getByLabelText('Alasan koreksi'), 'Surat dokter menyusul');
    // The button is a different element once it is enabled (the reason line is gone), so look it up again.
    await user.click(within(sheet).getByRole('button', { name: /^Ajukan koreksi/ }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith([{ id: 's5', status: 'S' }], 'Surat dokter menyusul');
  });
});

describe('a new roster replaces the old state', () => {
  it('a different session shows its own students, nothing of the last one', async () => {
    const { user, rerender, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: /Semua hadir/ }));
    rerender(
      <AttendanceFlow title="X-3 · Fisika" subtitle="Jam ke-4" dateLabel="Senin, 25 Januari" shortTitle="X-3" students={roster().slice(0, 3).map((s) => ({ ...s, id: `t-${s.id}` }))} backHref="/hari-ini" onSubmit={onSubmit} />,
    );
    await waitFor(() => expect(screen.getAllByRole('button', { name: /: Belum diisi\. Ketuk/ })).toHaveLength(3));
    expect(screen.queryByRole('button', { name: 'Urungkan' })).toBeNull();
  });
});

describe('the whole run of the contract', () => {
  it('25 students, Semua hadir, 3 exceptions, check, send: 9 taps', async () => {
    const { user, onSubmit } = setup();
    let taps = 0;
    const tap = async (el: HTMLElement) => {
      taps += 1;
      await user.click(el);
    };
    await tap(screen.getByRole('button', { name: /Semua hadir/ }));
    for (const [name, choice] of [['Bayu Firmansyah', 'Telat'], ['Rizky Maulana', 'Sakit'], ['Putri Ayu Lestari', 'Alpa']] as const) {
      await tap(row(name, 'Hadir'));
      const sheet = await screen.findByRole('dialog', { name: `Pilih kehadiran untuk ${name}` });
      await tap(within(sheet).getByRole('button', { name: new RegExp(`^${choice}:`) }));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
    await tap(screen.getByRole('button', { name: 'Periksa dan kirim' }));
    await tap(await screen.findByRole('button', { name: 'Kirim presensi' }));
    await screen.findByRole('heading', { name: 'Presensi X-2 terkirim' });
    expect(taps).toBe(9);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
