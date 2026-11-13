import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { place: { findFirst } } }));

import { placeSlugCandidates } from '@/lib/place-slug';
import { getPublicPlace } from '@/lib/place-repository';

const thai = 'กหกฟฟไกกไฟไกกฟไกฟห-xvs5rdi';

describe('placeSlugCandidates', () => {
  it('keeps a Latin slug as is', () => {
    expect(placeSlugCandidates('dwadawadwadwdsa-6srnjhv')).toEqual(['dwadawadwadwdsa-6srnjhv']);
  });

  it('adds the decoded form of a percent-encoded Thai slug', () => {
    expect(placeSlugCandidates(encodeURIComponent(thai))).toContain(thai);
  });

  it('adds NFC and NFD spellings', () => {
    const nfd = ('กิ่' + '-abc1234').normalize('NFD');
    const candidates = placeSlugCandidates(encodeURIComponent(nfd));
    expect(candidates).toContain(nfd.normalize('NFC'));
    expect(candidates).toContain(nfd.normalize('NFD'));
  });

  it('keeps extra dashes untouched', () => {
    expect(placeSlugCandidates('ก-ข--ค-abc1234')).toContain('ก-ข--ค-abc1234');
  });

  it('does not throw on invalid percent-encoding', () => {
    expect(placeSlugCandidates('100%-abc')).toContain('100%-abc');
  });
});

describe('getPublicPlace lookup', () => {
  beforeEach(() => findFirst.mockReset().mockResolvedValue(null));

  it('looks a percent-encoded Thai slug up by its stored (decoded) spelling', async () => {
    await getPublicPlace(encodeURIComponent(thai));
    const where = findFirst.mock.calls[0]![0].where;
    expect(where.OR[0].slug.in).toContain(thai);
  });

  it('still looks a Latin slug up exactly as before', async () => {
    await getPublicPlace('dwadawadwadwdsa-6srnjhv');
    expect(findFirst.mock.calls[0]![0].where.OR).toEqual([
      { slug: { in: ['dwadawadwadwdsa-6srnjhv'] } },
      { id: 'dwadawadwadwdsa-6srnjhv' },
    ]);
  });

  it('returns null for an unknown slug', async () => {
    expect(await getPublicPlace('no-such-place-0000000')).toBeNull();
  });

  it('keeps the visibility rules for hidden, deleted and pending places', async () => {
    await getPublicPlace(encodeURIComponent(thai));
    const where = findFirst.mock.calls[0]![0].where;
    expect(where.isVisible).toBe(true);
    expect(where.deletedAt).toBeNull();
    expect(where.status).toEqual({ not: 'PENDING' });
  });
});
