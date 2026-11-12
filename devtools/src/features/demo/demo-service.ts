import type { PrismaClient } from '@prisma/client';

import { recomputePlaceRating } from '@/lib/place-rating';
import { buildDemoContent } from './demo-content';
import {
  DEMO_AUDIT,
  DEMO_EMAIL_DOMAIN,
  demoIdPrefix,
  emptyDemoCounts,
  type DemoCounts,
} from './demo-config';

/** Everything the tools need from the outside, so tests can run them without object storage or sharp. */
export interface DemoDeps {
  db: PrismaClient;
  now: Date;
  /** The admin who pressed the button; recorded in the audit log. */
  actorId: string;
  storage: {
    put: (key: string, bytes: Uint8Array, contentType: string) => Promise<unknown>;
    remove: (key: string) => Promise<unknown>;
  };
  renderImage: (color: string) => Promise<Uint8Array>;
  /** E-mails of the two seeded regular accounts, who get sample data too and chat in the same Meetups. */
  demoUserEmail?: string;
  demoUser2Email?: string;
}

const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 } as const;
const startsWith = (kind: Parameters<typeof demoIdPrefix>[0]) => ({
  startsWith: demoIdPrefix(kind),
});

/**
 * Creates the sample data. Idempotent: every row has a fixed `demo_…` id and is inserted with
 * "skip duplicates", so a second run adds nothing. Returns how many rows were really inserted.
 */
export async function createDemoData(deps: DemoDeps): Promise<DemoCounts> {
  const { db, now, actorId } = deps;
  const places = await db.place.findMany({
    where: { isVisible: true, deletedAt: null },
    orderBy: { slug: 'asc' },
    take: 8,
    select: { id: true, nameTh: true },
  });
  if (places.length === 0) throw new Error('DEMO_NO_PLACES');
  const [province, category, demoUser, demoUser2] = await Promise.all([
    db.province
      .findFirst({ where: { code: '10' }, select: { id: true } })
      .then((found) => found ?? db.province.findFirstOrThrow({ select: { id: true } })),
    db.category
      .findFirst({ where: { code: 'CAFE' }, select: { id: true } })
      .then((found) => found ?? db.category.findFirstOrThrow({ select: { id: true } })),
    db.user.findFirst({
      where: { email: deps.demoUserEmail ?? 'demo-user@example.com', deletedAt: null },
      select: { id: true },
    }),

    db.user.findFirst({
      where: { email: deps.demoUser2Email ?? 'demo-user2@example.com', deletedAt: null },
      select: { id: true },
    }),
  ]);

  const content = buildDemoContent({
    now,
    places,
    provinceId: province.id,
    categoryId: category.id,
    demoUserId: demoUser?.id ?? null,
    demoUser2Id: demoUser2?.id ?? null,
  });

  // Photos first: the chat messages that show them are inserted next. Fixed keys, so a re-run overwrites.
  for (const image of content.images)
    await deps.storage.put(image.key, await deps.renderImage(image.color), 'image/png');

  const counts = emptyDemoCounts();
  await db.$transaction(async (tx) => {
    const insert = { skipDuplicates: true } as const;
    counts.users = (await tx.user.createMany({ data: content.users, ...insert })).count;
    counts.pets = (await tx.pet.createMany({ data: content.pets, ...insert })).count;
    counts.meetups = (await tx.meetup.createMany({ data: content.meetups, ...insert })).count;
    counts.members = (await tx.meetupMember.createMany({ data: content.members, ...insert })).count;
    counts.messages = (
      await tx.meetupMessage.createMany({ data: content.messages, ...insert })
    ).count;
    counts.reviews = (await tx.review.createMany({ data: content.reviews, ...insert })).count;
    counts.submissions = (
      await tx.submission.createMany({ data: content.submissions, ...insert })
    ).count;
    counts.notifications = (
      await tx.notification.createMany({ data: content.notifications, ...insert })
    ).count;
    counts.meetupReports = (
      await tx.meetupReport.createMany({ data: content.meetupReports, ...insert })
    ).count;
    counts.placeReports = (
      await tx.report.createMany({ data: content.placeReports, ...insert })
    ).count;

    const reviewed = await tx.review.findMany({
      where: { id: startsWith('review') },
      select: { placeId: true },
    });
    for (const placeId of new Set(reviewed.map((review) => review.placeId)))
      await recomputePlaceRating(tx, placeId);

    await tx.auditLog.create({
      data: {
        actorId,
        action: DEMO_AUDIT.create,
        entityType: DEMO_AUDIT.entityType,
        entityId: DEMO_AUDIT.entityId,
        newValue: { ...counts },
        reason: 'Admin demo tools: create sample data',
      },
    });
  }, TX_OPTIONS);
  return counts;
}

/**
 * Deletes only rows whose id carries the `demo_` marker (and, for members, the reserved e-mail
 * domain), children before parents, then recomputes the rating of every place that had a demo review.
 * Safe to run when nothing exists. Imported places, real users and the seeded demo accounts are never
 * selected by any of these filters.
 */
export async function deleteDemoData(deps: DemoDeps): Promise<DemoCounts> {
  const { db, actorId } = deps;
  const counts = emptyDemoCounts();
  let imageKeys: string[] = [];

  await db.$transaction(async (tx) => {
    const reviewed = await tx.review.findMany({
      where: { id: startsWith('review') },
      select: { placeId: true },
    });
    const affectedPlaceIds = [...new Set(reviewed.map((review) => review.placeId))];
    const photos = await tx.meetupMessage.findMany({
      where: {
        objectKey: { not: null },
        OR: [{ id: startsWith('msg') }, { meetupId: startsWith('meetup') }],
      },
      select: { objectKey: true },
    });
    imageKeys = photos.flatMap((photo) => (photo.objectKey ? [photo.objectKey] : []));

    counts.meetupReports = (
      await tx.meetupReport.deleteMany({ where: { id: startsWith('mreport') } })
    ).count;
    counts.placeReports = (
      await tx.report.deleteMany({ where: { id: startsWith('report') } })
    ).count;
    counts.notifications = (
      await tx.notification.deleteMany({ where: { id: startsWith('notif') } })
    ).count;
    counts.reviews = (await tx.review.deleteMany({ where: { id: startsWith('review') } })).count;
    counts.submissions = (
      await tx.submission.deleteMany({ where: { id: startsWith('sub') } })
    ).count;
    counts.messages = (
      await tx.meetupMessage.deleteMany({ where: { id: startsWith('msg') } })
    ).count;
    counts.members = (
      await tx.meetupMember.deleteMany({ where: { id: startsWith('member') } })
    ).count;
    counts.meetups = (await tx.meetup.deleteMany({ where: { id: startsWith('meetup') } })).count;
    counts.pets = (await tx.pet.deleteMany({ where: { id: startsWith('pet') } })).count;
    counts.users = (
      await tx.user.deleteMany({
        where: { id: startsWith('user'), email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
      })
    ).count;

    const stillThere = await tx.place.findMany({
      where: { id: { in: affectedPlaceIds } },
      select: { id: true },
    });
    for (const place of stillThere) await recomputePlaceRating(tx, place.id);

    await tx.auditLog.create({
      data: {
        actorId,
        action: DEMO_AUDIT.delete,
        entityType: DEMO_AUDIT.entityType,
        entityId: DEMO_AUDIT.entityId,
        newValue: { ...counts },
        reason: 'Admin demo tools: delete sample data',
      },
    });
  }, TX_OPTIONS);

  // Stored photos go after the database commit; a storage hiccup must not undo the deletion.
  for (const key of imageKeys) await deps.storage.remove(key).catch(() => undefined);
  return counts;
}
