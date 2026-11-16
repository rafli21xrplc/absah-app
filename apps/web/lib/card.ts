import { CardDeviceKeys, fromBase64Url, makeCardToken, schoolDateAt, TOKEN_WINDOW_SECONDS, windowAt } from '@absah/contracts';

/**
 * The dynamic card QR (GRB-01) on a phone: day keys from the API, a token per 30-second window.
 * Keys are kept on the phone so the card works a week without signal.
 */
export async function cardTokenAt(keys: CardDeviceKeys, ms: number): Promise<string | null> {
  const key = keys.keys.find((k) => k.schoolDate === schoolDateAt(keys.timezone, ms));
  if (!key) return null;
  return makeCardToken({ cardId: keys.cardId, deviceId: keys.deviceId, deviceKey: fromBase64Url(key.key), ms });
}

/** Seconds until the QR changes. */
export const secondsLeft = (ms: number) => TOKEN_WINDOW_SECONDS - (Math.floor(ms / 1000) % TOKEN_WINDOW_SECONDS);
export const sameWindow = (a: number, b: number) => windowAt(a) === windowAt(b);

/** The last day key the phone holds, so the page can say when it must go online again. */
export const lastKeyDate = (keys: CardDeviceKeys) => keys.keys.map((k) => k.schoolDate).sort().at(-1) ?? null;

export function loadKeys(storageKey: string): CardDeviceKeys | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = CardDeviceKeys.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function storeKeys(storageKey: string, keys: CardDeviceKeys | null): void {
  try {
    if (keys) localStorage.setItem(storageKey, JSON.stringify(keys));
    else localStorage.removeItem(storageKey);
  } catch {
    // private mode or full storage: the card then needs signal each day
  }
}
