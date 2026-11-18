import { PICKUP_RELATIONS } from '@absah/contracts';
import { describe, expect, it, vi } from 'vitest';
import { fitWithin, putPhoto, RELATION_LABELS, RELATIONS } from './pickup';

describe('pickup helpers', () => {
  it('labels every relation the API knows', () => {
    expect(RELATIONS.sort()).toEqual([...PICKUP_RELATIONS].sort());
    expect(RELATION_LABELS.sopir).toContain('Sopir');
  });

  it('scales a photo down to the longest side, never up', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 960, height: 720 });
    expect(fitWithin(1080, 1920)).toEqual({ width: 540, height: 960 });
    expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it('PUTs with the presigned headers and fails on an error status', async () => {
    const put = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await putPhoto({ url: 'https://r2.test/x', headers: { 'content-type': 'image/jpeg' } }, new Blob(['x']), put);
    expect(put).toHaveBeenCalledWith('https://r2.test/x', expect.objectContaining({ method: 'PUT', headers: { 'content-type': 'image/jpeg' } }));
    await expect(putPhoto({ url: 'u', headers: {} }, new Blob(['x']), vi.fn().mockResolvedValue(new Response(null, { status: 403 })))).rejects.toThrow('upload_403');
  });
});
