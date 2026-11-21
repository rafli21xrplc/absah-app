import { PushSubscribeRequest } from '@absah/contracts';

/** What this browser can do about Web Push, in the order a person would hit it. */
export type PushAvailability = 'unsupported' | 'off' | 'denied' | 'ready';

export interface PushEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  /** Notification.permission, or null without the Notification API. */
  permission: NotificationPermission | null;
  /** GET /push/config: null when the server has no VAPID keys. */
  publicKey: string | null;
}

/**
 * unsupported: this browser cannot (iPhones only inside an installed app); off: the server has push
 * switched off; denied: the person said no in the browser settings; ready: can be turned on.
 */
export function pushAvailability(env: PushEnv): PushAvailability {
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported';
  if (!env.publicKey) return 'off';
  if (env.permission === 'denied') return 'denied';
  return 'ready';
}

/** The browser wants the VAPID key as bytes; the server hands it over as base64url. */
export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** PushSubscription.toJSON() checked against the API's contract before it is sent. Null when the browser gave less. */
export function subscribeBody(json: PushSubscriptionJSON): PushSubscribeRequest | null {
  const parsed = PushSubscribeRequest.safeParse({ endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } });
  return parsed.success ? parsed.data : null;
}

/** Remembered per school and browser: the server does not say which endpoint is registered where. Best effort. */
export const pushFlagKey = (schoolId: string) => `absah.push.${schoolId}`;

/** Other schools this browser was registered for (their flags), so turning one off keeps the browser subscribed for the rest. */
export function otherPushSchools(storage: Pick<Storage, 'length' | 'key'>, schoolId: string): string[] {
  const prefix = pushFlagKey('');
  const ids: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(prefix) && key !== pushFlagKey(schoolId)) ids.push(key.slice(prefix.length));
  }
  return ids;
}
