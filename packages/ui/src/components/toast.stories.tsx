import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './button';
import { Toast, ToastProvider } from './toast';

const meta = { title: 'Primitif/Toast', component: Toast, args: { open: false, onOpenChange: () => undefined, message: 'Tersimpan.' }, decorators: [(S) => <ToastProvider><S /></ToastProvider>] } satisfies Meta<typeof Toast>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Tandai semua hadir</Button>
        <Toast open={open} onOpenChange={setOpen} message="22 siswa ditandai Hadir." onUndo={() => setOpen(false)} />
      </>
    );
  },
};

/** Opened from the start so the visual check and axe see it. Closing it does not reopen it. */
export const OpenWithUndo: Story = { args: { open: true, onOpenChange: () => undefined, message: '22 siswa ditandai Hadir.', onUndo: () => undefined, duration: 600000 } };
export const OpenWithoutUndo: Story = { args: { open: true, onOpenChange: () => undefined, message: 'Tersimpan.', duration: 600000 } };
