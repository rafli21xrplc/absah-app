'use client';

import { PushConfig, PushStatus } from '@absah/contracts';
import { Button, LoadingState } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { otherPushSchools, pushAvailability, pushFlagKey, subscribeBody, urlBase64ToBytes, type PushAvailability } from '@/lib/push';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';

interface Browser {
  availability: PushAvailability;
  publicKey: string | null;
  /** This browser holds a push subscription (for any school). */
  subscribed: boolean;
}

const MESSAGES: Record<Exclude<PushAvailability, 'ready'>, string> = {
  unsupported: 'Browser ini belum mendukung notifikasi. Di iPhone, pasang Absah ke layar utama dulu, lalu buka dari sana.',
  off: 'Notifikasi push belum diaktifkan di server Absah. Hubungi admin.',
  denied: 'Notifikasi diblokir di pengaturan browser. Izinkan untuk situs ini, lalu muat ulang halaman.',
};

const readFlag = (schoolId: string) => {
  try {
    return localStorage.getItem(pushFlagKey(schoolId)) === '1';
  } catch {
    return false;
  }
};

/**
 * Notifikasi di HP ini (NTF-06): staff turn Web Push on for the active school. It tells them a guest
 * waits, a session is unfilled or an izin waits; never who or about whom (it shows on a lock screen).
 * The browser holds one subscription; the API keeps it per school, so it is turned on once per school.
 */
export default function Pengaturan() {
  const { schoolId, me } = useWorkspace();
  const schoolName = me.schools.find((s) => s.id === schoolId)?.name;
  const [browser, setBrowser] = useState<Browser | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    const controller = new AbortController();
    void (async () => {
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasPushManager = 'PushManager' in window;
      const hasNotification = 'Notification' in window;
      const config = await api('/push/config', PushConfig, { schoolId, signal: controller.signal }).catch(() => ({ publicKey: null }));
      const reg = hasServiceWorker && hasPushManager ? await navigator.serviceWorker.getRegistration('/') : undefined;
      const subscription = await reg?.pushManager.getSubscription();
      if (controller.signal.aborted) return;
      setBrowser({
        availability: pushAvailability({ hasServiceWorker, hasPushManager, hasNotification, permission: hasNotification ? Notification.permission : null, publicKey: config.publicKey }),
        publicKey: config.publicKey,
        subscribed: Boolean(subscription),
      });
      setActive(Boolean(subscription) && readFlag(schoolId));
    })();
    return () => controller.abort();
  }, [schoolId]);

  async function enable() {
    if (!schoolId || !browser?.publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        setMessage(MESSAGES.denied);
        return;
      }
      // The same worker as the portal's: one worker per scope, and it also shows the push.
      const reg = await navigator.serviceWorker.register('/portal-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(browser.publicKey) }));
      const body = subscribeBody(subscription.toJSON());
      if (!body) {
        setMessage('Browser tidak memberi data langganan yang lengkap. Coba browser lain.');
        return;
      }
      await api('/push/subscriptions', PushStatus, { method: 'PUT', schoolId, idempotencyKey: newIdempotencyKey(), body });
      try {
        localStorage.setItem(pushFlagKey(schoolId), '1');
      } catch {
        // private mode: it still works, the page just forgets that it is on
      }
      setBrowser({ ...browser, subscribed: true });
      setActive(true);
      setMessage('Notifikasi aktif di HP ini.');
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Tidak bisa mengaktifkan notifikasi. Periksa internet dan coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!schoolId) return;
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const subscription = await reg?.pushManager.getSubscription();
      if (subscription) await api('/push/subscriptions/remove', PushStatus, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { endpoint: subscription.endpoint } });
      try {
        localStorage.removeItem(pushFlagKey(schoolId));
        // The browser keeps its subscription while another school still uses it.
        if (subscription && otherPushSchools(localStorage, schoolId).length === 0) await subscription.unsubscribe();
      } catch {
        // storage unavailable: leave the browser subscription, the server no longer sends to it
      }
      setActive(false);
      setBrowser((b) => (b ? { ...b, subscribed: otherPushSchools(localStorage, schoolId).length > 0 } : b));
      setMessage('Notifikasi dimatikan di HP ini.');
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Tidak bisa mematikan notifikasi. Periksa internet dan coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Notifikasi di HP ini</h1>
      {schoolName && <p>{schoolName}</p>}
      <p>Absah memberi tahu Anda saat ada tamu yang menunggu, sesi yang belum diisi, atau izin siswa yang perlu disetujui. Pesan tidak memuat nama siapa pun.</p>
      {!browser && <LoadingState variant="detail" />}
      {browser && browser.availability !== 'ready' && <p role="status">{MESSAGES[browser.availability]}</p>}
      {browser?.availability === 'ready' && (
        <p>
          <Button disabled={busy} onClick={() => void (active ? disable() : enable())}>
            {active ? 'Matikan notifikasi di HP ini' : 'Aktifkan notifikasi di HP ini'}
          </Button>
        </p>
      )}
      {browser?.availability === 'ready' && !active && <p>Bila Anda bekerja di lebih dari satu sekolah, aktifkan lagi setelah memilih sekolah itu.</p>}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
