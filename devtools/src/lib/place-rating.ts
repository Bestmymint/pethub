import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Recomputes a place's average rating and review count from its reviews that are neither hidden nor
 * deleted. The review form and the demo-data tools both call it, so the numbers always mean the same.
 */
export async function recomputePlaceRating(
  client: Prisma.TransactionClient | PrismaClient,
  placeId: string,
) {
  const aggregate = await client.review.aggregate({
    where: { placeId, isHidden: false, deletedAt: null },
    _avg: { rating: true },
    _count: true,
  });
  await client.place.update({
    where: { id: placeId },
    data: { averageRating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count },
  });
}
