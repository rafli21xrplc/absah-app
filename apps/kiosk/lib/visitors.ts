import { CreateVisitorPhotoResponse, VISITOR_PHOTO_MAX_BYTES, VISITOR_PHOTO_TYPE, Visitor, VisitorHostList } from '@absah/contracts';
import { KioskApiError, type KioskApi } from './kiosk-api';

/** The guest book form (GRB-11). Empty strings mean "not filled". */
export interface VisitorForm {
  name: string;
  organization: string;
  purpose: string;
  hostUserId: string;
}
export const EMPTY_FORM: VisitorForm = { name: '', organization: '', purpose: '', hostUserId: '' };

/** A short plain reason when the form cannot be sent yet, else null. Mirrors the API's limits. */
export function validateVisitor(form: VisitorForm): string | null {
  if (form.name.trim().length === 0) return 'Tulis nama Anda.';
  if (form.name.trim().length > 100) return 'Nama terlalu panjang.';
  if (form.organization.trim().length > 100) return 'Nama instansi terlalu panjang.';
  if (form.purpose.trim().length === 0) return 'Tulis tujuan kunjungan.';
  if (form.purpose.trim().length > 200) return 'Tujuan terlalu panjang.';
  return null;
}

/**
 * Ids that make a resend safe: the same visit keeps its clientEventId and Idempotency-Keys until it
 * went through, so a retry after a dropped connection records one visit and one photo.
 */
export interface Attempt {
  clientEventId: string;
  submitKey: string;
  photoKey: string;
  photoId?: string;
  upload?: { url: string; headers: Record<string, string> };
  uploaded?: boolean;
}
export const newAttempt = (): Attempt => ({ clientEventId: crypto.randomUUID(), submitKey: crypto.randomUUID(), photoKey: crypto.randomUUID() });

export interface RegisterDeps {
  api: KioskApi;
  token: string;
  /** fetch for the presigned PUT (injected in tests). */
  put?: typeof fetch;
}

async function uploadPhoto({ api, token, put = fetch }: RegisterDeps, photo: Blob, attempt: Attempt): Promise<string> {
  if (attempt.photoId && attempt.uploaded) return attempt.photoId;
  try {
    if (!attempt.photoId || !attempt.upload) {
      const res = await api('/kiosk/visitor-photos', CreateVisitorPhotoResponse, {
        method: 'POST',
        token,
        idempotencyKey: attempt.photoKey,
        body: { fileSize: photo.size, contentType: VISITOR_PHOTO_TYPE },
      });
      attempt.photoId = res.photoId;
      attempt.upload = { url: res.upload.url, headers: res.upload.headers };
    }
    const res = await put(attempt.upload.url, { method: 'PUT', headers: attempt.upload.headers, body: photo });
    if (!res.ok) throw new Error(`upload_${res.status}`);
    attempt.uploaded = true;
    return attempt.photoId;
  } catch (err) {
    // The presigned link lives 5 minutes: after a failure the next try asks for a fresh one.
    if (!(err instanceof TypeError)) {
      attempt.photoId = undefined;
      attempt.upload = undefined;
      attempt.photoKey = crypto.randomUUID();
    }
    throw err;
  }
}

/**
 * A guest signs in: optional photo (presign, PUT), then the visit. Network failures throw a
 * TypeError (offline, as everywhere in the kiosk); the same Attempt can be passed again.
 */
export async function registerVisit(deps: RegisterDeps, form: VisitorForm, photo: Blob | null, attempt: Attempt): Promise<Visitor> {
  const problem = validateVisitor(form);
  if (problem) throw new Error(problem);
  if (photo && photo.size > VISITOR_PHOTO_MAX_BYTES) photo = null; // too big to send: the visit matters more
  const photoId = photo ? await uploadPhoto(deps, photo, attempt) : undefined;
  return deps.api('/kiosk/visitors', Visitor, {
    method: 'POST',
    token: deps.token,
    idempotencyKey: attempt.submitKey,
    body: {
      clientEventId: attempt.clientEventId,
      name: form.name.trim(),
      ...(form.organization.trim() ? { organization: form.organization.trim() } : {}),
      purpose: form.purpose.trim(),
      ...(form.hostUserId ? { hostUserId: form.hostUserId } : {}),
      ...(photoId ? { photoId } : {}),
    },
  });
}

/** null = the school does not use the guest book (404 CAPABILITY_DISABLED) or we are offline. */
export async function loadHosts(api: KioskApi, token: string): Promise<VisitorHostList['items'] | null> {
  try {
    return (await api('/kiosk/visitor-hosts', VisitorHostList, { token })).items;
  } catch (err) {
    if (err instanceof KioskApiError && err.status === 404) return null;
    throw err;
  }
}

/** Plain words for a failed send. */
export function visitorError(err: unknown): string {
  if (err instanceof TypeError) return 'Tidak ada sambungan internet. Coba lagi sebentar lagi.';
  if (err instanceof KioskApiError && err.status === 400) return err.message;
  return 'Belum terkirim. Coba lagi, atau lapor ke guru piket.';
}
